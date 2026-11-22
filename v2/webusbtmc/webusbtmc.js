/**
 * Copyright (C) Naoya Imai
 *
 * Licensed under Apache 2.0
 *
 * USBTMC on WebUSB API
 */

'use strict';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Base class of every error thrown by this driver. */
export class UsbtmcError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A Bulk-IN / Interrupt-IN transfer did not complete in time. */
export class UsbtmcTimeoutError extends UsbtmcError { }

/** The device answered in a way the USBTMC specification does not allow. */
export class UsbtmcProtocolError extends UsbtmcError { }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Bulk message IDs
const MSGID_DEV_DEP_MSG_OUT = 0x01;
const MSGID_REQUEST_DEV_DEP_MSG_IN = 0x02;
const MSGID_DEV_DEP_MSG_IN = 0x02;

// Control requests (USBTMC)
const REQ_INITIATE_ABORT_BULK_IN = 0x03;
const REQ_CHECK_ABORT_BULK_IN_STATUS = 0x04;
const REQ_INITIATE_CLEAR = 0x05;
const REQ_CHECK_CLEAR_STATUS = 0x06;
const REQ_GET_CAPABILITIES = 0x07;

// Control requests (USB488)
const REQ_READ_STATUS_BYTE = 128;
const REQ_REN_CONTROL = 160;
const REQ_GO_TO_LOCAL = 161;

// USBTMC_status
const STATUS_SUCCESS = 0x01;
const STATUS_PENDING = 0x02;
const STATUS_FAILED = 0x80;
const STATUS_TRANSFER_NOT_IN_PROGRESS = 0x81;

const HEADER_SIZE = 12;
const MAX_POLLS = 16;
const POLL_INTERVAL_MS = 10;
const DRAIN_TIMEOUT_MS = 100;
const DRAIN_LIMIT_MS = 2000;
const MAX_SKIPPED_EMPTY_PACKETS = 2;
const MAX_STALE_ANSWERS = 4;

const TIMED_OUT = Symbol('timed out');

class Webusbtmc {
  #bcdUSBTMC;
  #usbtmcInterfaceCapabilities;
  #usbtmcDeviceCapabilities;
  #bcdUSB488;
  #usb488InterfaceCapabilities;
  #usb488DeviceCapabilities;
  #lastbulkoutbTag;
  #bulkoutbTag;
  #rtbbTag;

  #device;
  #interfaceNumber;
  #alternateSetting;

  #bulkinEndpointNum;
  #bulkinPacketSize;
  #bulkoutEndpointNum;
  #bulkoutPacketSize;
  #interruptinEndpointNum;
  #interruptinPacketSize;

  #terminatorWrite;
  #terminatorRead;

  // IN transfers whose result has not been handed to a reader yet, by endpoint number.
  #pendingIn;

  // The bTags of requests whose answer was not waited for to the end (timeout). The answer can still
  // arrive late; it is skipped instead of being taken for the answer of the next request.
  #abandonedTags;

  constructor() {
    this.#terminatorWrite = '\n';
    this.#terminatorRead = '\n';
    this.#resetState();
  }

  #resetState() {
    this.#bcdUSBTMC = -1;
    this.#usbtmcInterfaceCapabilities = -1;
    this.#usbtmcDeviceCapabilities = -1;
    this.#bcdUSB488 = -1;
    this.#usb488InterfaceCapabilities = -1;
    this.#usb488DeviceCapabilities = -1;
    this.#lastbulkoutbTag = 1;
    this.#bulkoutbTag = 1;
    this.#rtbbTag = 2;

    this.#device = null;
    this.#interfaceNumber = 0;
    this.#alternateSetting = 0;

    this.#bulkinEndpointNum = -1;
    this.#bulkinPacketSize = 64;
    this.#bulkoutEndpointNum = -1;
    this.#bulkoutPacketSize = 64;
    this.#interruptinEndpointNum = -1;
    this.#interruptinPacketSize = 64;

    this.#pendingIn = new Map();
    this.#abandonedTags = new Set();
  }

  get bcdUSBTMC() {
    return this.#bcdUSBTMC;
  }
  get usbtmcInterfaceCapabilities() {
    return this.#usbtmcInterfaceCapabilities;
  }
  get usbtmcDeviceCapabilities() {
    return this.#usbtmcDeviceCapabilities;
  }
  get bcdUSB488() {
    return this.#bcdUSB488;
  }
  get usb488InterfaceCapabilities() {
    return this.#usb488InterfaceCapabilities;
  }
  get usb488DeviceCapabilities() {
    return this.#usb488DeviceCapabilities;
  }

  get device() {
    return this.#device;
  }

  get terminatorWrite() {
    return this.#terminatorWrite;
  }

  set terminatorWrite(char) {
    this.#terminatorWrite = char;
  }

  get terminatorRead() {
    return this.#terminatorRead;
  }

  set terminatorRead(char) {
    this.#terminatorRead = char;
  }

  get opened() {
    if (this.#device === undefined || this.#device === null) {
      return false;
    }
    return this.#device.opened;
  }

  delay(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms, 'done'));
  }

  // -------------------------------------------------------------------------
  // Open / close
  // -------------------------------------------------------------------------

  async open(device) {
    if (this.opened) {
      throw new UsbtmcError('A device is already open');
    }
    this.#resetState();

    await device.open();
    this.#device = device;

    try {
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      this.#findInterface();

      await device.claimInterface(this.#interfaceNumber);
      await device.selectAlternateInterface(this.#interfaceNumber, this.#alternateSetting);

      await this.#getCapabilities();

      if ((this.#usb488DeviceCapabilities & 0x02) == 0x02) {
        // The interface accepts REN_CONTROL, GO_TO_LOCAL, and LOCAL_LOCKOUT requests.
        const data = await this.#controlIn('REN_CONTROL', 'interface', REQ_REN_CONTROL, 0x01, this.#interfaceNumber, 1);
        this.#expectSuccess('REN_CONTROL', data.getUint8(0));
      }

      await this.#discardStaleAnswers();
    } catch (error) {
      try {
        await device.close();
      } catch (closeError) {
        // The original error is more useful.
      }
      this.#device = null;
      throw error;
    }
  }

  async close() {
    if (!this.opened) {
      return;
    }

    try {
      if ((this.#usb488DeviceCapabilities & 0x02) == 0x02) {
        await this.#controlIn('GO_TO_LOCAL', 'interface', REQ_GO_TO_LOCAL, 0x00, this.#interfaceNumber, 1);
        await this.#controlIn('REN_CONTROL', 'interface', REQ_REN_CONTROL, 0x00, this.#interfaceNumber, 1);
      }
    } catch (error) {
      // Best effort: the device may already be gone.
    } finally {
      await this.#device.close();
    }
  }

  #findInterface() {
    let found = false;

    for (const element of this.#device.configuration.interfaces) {
      for (const elementalt of element.alternates) {
        if (found) {
          break;
        }
        if (elementalt.interfaceClass == 0xfe && elementalt.interfaceSubclass == 0x03 && elementalt.interfaceProtocol == 0x01) {
          found = true;
          this.#interfaceNumber = element.interfaceNumber;
          this.#alternateSetting = elementalt.alternateSetting;

          for (const elementendpoint of elementalt.endpoints) {
            if (elementendpoint.type == 'bulk') {
              if (elementendpoint.direction == 'out') {
                this.#bulkoutEndpointNum = elementendpoint.endpointNumber;
                this.#bulkoutPacketSize = elementendpoint.packetSize;
              } else if (elementendpoint.direction == 'in') {
                this.#bulkinEndpointNum = elementendpoint.endpointNumber;
                this.#bulkinPacketSize = elementendpoint.packetSize;
              }
            } else if (elementendpoint.type == 'interrupt') {
              if (elementendpoint.direction == 'in') {
                this.#interruptinEndpointNum = elementendpoint.endpointNumber;
                this.#interruptinPacketSize = elementendpoint.packetSize;
              }
            }
          }
        }
      }
    }

    if (!found) {
      throw new UsbtmcError('No USBTMC interface found');
    }
    if (this.#bulkinEndpointNum == -1 || this.#bulkoutEndpointNum == -1) {
      throw new UsbtmcError('No appropriate Bulk-IN/Bulk-OUT endpoint found');
    }
  }

  async #getCapabilities() {
    const data = await this.#controlIn('GET_CAPABILITIES', 'interface', REQ_GET_CAPABILITIES, 0x00, this.#interfaceNumber, 24, 16);
    this.#expectSuccess('GET_CAPABILITIES', data.getUint8(0));

    // All multi-byte fields are little endian.
    this.#bcdUSBTMC = data.getUint16(2, true);
    this.#usbtmcInterfaceCapabilities = data.getUint8(4);
    this.#usbtmcDeviceCapabilities = data.getUint8(5);
    this.#bcdUSB488 = data.getUint16(12, true);
    this.#usb488InterfaceCapabilities = data.getUint8(14);
    this.#usb488DeviceCapabilities = data.getUint8(15);
  }

  // -------------------------------------------------------------------------
  // Write
  // -------------------------------------------------------------------------

  async write(text) {
    const textEncoder = new TextEncoder();
    const bytes = textEncoder.encode(text + this.#terminatorWrite);
    await this.writeBytes(bytes);
  }

  /**
   * Sends bytes as DEV_DEP_MSG_OUT messages. Each message carries at most one
   * Bulk-OUT packet; the last one has EOM set. Empty input sends nothing.
   */
  async writeBytes(bytes) {
    this.#assertOpened();

    const maxPayload = this.#bulkoutPacketSize - HEADER_SIZE;
    let currentIndex = 0;
    while (currentIndex < bytes.length) {
      const size = Math.min(maxPayload, bytes.length - currentIndex);
      const isLast = (currentIndex + size) >= bytes.length;
      const attributes = isLast ? 0x01 : 0x00;   // D0: EOM
      await this.#transmit(MSGID_DEV_DEP_MSG_OUT, size, attributes, 0x00, bytes.subarray(currentIndex, currentIndex + size));
      currentIndex += size;
    }
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  /**
   * Reads a text response and removes one trailing read terminator.
   * Throws UsbtmcTimeoutError / UsbtmcProtocolError / UsbtmcError on failure.
   */
  async read(length = 1024, timeout = 5000) {
    const bytes = await this.readBytes(length, timeout);
    const textDecoder = new TextDecoder();
    const text = textDecoder.decode(bytes);
    if (this.#terminatorRead && text.endsWith(this.#terminatorRead)) {
      return text.slice(0, -this.#terminatorRead.length);
    }
    return text;
  }

  async query(text, length = 1024, timeout = 5000) {
    await this.write(text);
    return await this.read(length, timeout);
  }

  /**
   * Reads one response of up to `length` bytes. Requests are repeated until
   * the device sets EOM or `length` bytes have been received. If the response
   * is longer than `length`, the rest stays in the device (use clear()).
   * `timeout` applies to each Bulk-IN transfer.
   */
  async readBytes(length = 1024, timeout = 5000) {
    this.#assertOpened();

    const chunks = [];
    let total = 0;
    while (true) {
      const message = await this.#readMessage(length - total, timeout);
      if (message.data.length === 0 && !message.eom) {
        throw new UsbtmcProtocolError('Empty DEV_DEP_MSG_IN without EOM');
      }
      chunks.push(message.data);
      total += message.data.length;
      if (message.eom || total >= length) {
        break;
      }
    }
    return this.#concat(chunks, total);
  }

  /**
   * Requests one DEV_DEP_MSG_IN (at most `maxLength` bytes) and receives it.
   * The header is validated: MsgID, bTag, bTagInverse and TransferSize.
   */
  async #readMessage(maxLength, timeout) {
    await this.#transmit(MSGID_REQUEST_DEV_DEP_MSG_IN, maxLength, 0x00, 0x00, null);
    const expectedTag = this.#lastbulkoutbTag;

    let first;
    try {
      first = await this.#readFirstPacket(timeout);
      // The answer to a request that timed out earlier can still come. It is skipped.
      while (this.#isAbandonedAnswer(first, expectedTag)) {
        this.#abandonedTags.delete(first.getUint8(1));
        await this.#skipMessage(first, timeout);
        first = await this.#readFirstPacket(timeout);
      }
    } catch (error) {
      if (error instanceof UsbtmcTimeoutError) {
        this.#abandonedTags.add(expectedTag);   // the answer may still come
      }
      throw error;
    }
    if (first.byteLength < HEADER_SIZE) {
      throw new UsbtmcProtocolError('Bulk-IN packet is shorter than the USBTMC header');
    }

    if (first.getUint8(0) !== MSGID_DEV_DEP_MSG_IN) {
      throw new UsbtmcProtocolError('Unexpected MsgID 0x' + first.getUint8(0).toString(16));
    }
    if (first.getUint8(1) !== expectedTag || first.getUint8(2) !== (~expectedTag & 0xFF)) {
      throw new UsbtmcProtocolError('bTag mismatch in Bulk-IN header');
    }
    this.#abandonedTags.clear();   // the answers that were given up can no longer come before this one

    const transferSize = first.getUint32(4, true);
    const eom = (first.getUint8(8) & 0x01) === 0x01;
    if (transferSize > maxLength) {
      throw new UsbtmcProtocolError('Device returned ' + transferSize + ' bytes, more than the ' + maxLength + ' requested');
    }

    const data = new Uint8Array(transferSize);
    let received = Math.min(first.byteLength - HEADER_SIZE, transferSize);
    data.set(new Uint8Array(first.buffer, first.byteOffset + HEADER_SIZE, received), 0);

    while (received < transferSize) {
      const chunk = await this.#bulkIn(this.#bulkinPacketSize, timeout);
      if (chunk.byteLength === 0) {
        throw new UsbtmcProtocolError('Unexpected empty Bulk-IN packet');
      }
      const size = Math.min(chunk.byteLength, transferSize - received);
      data.set(new Uint8Array(chunk.buffer, chunk.byteOffset, size), received);
      received += size;
    }

    return { data: data, eom: eom };
  }

  async #readFirstPacket(timeout) {
    let packet = await this.#bulkIn(this.#bulkinPacketSize, timeout);
    // A zero-length packet may remain from the previous transfer.
    for (let skipped = 0; packet.byteLength === 0 && skipped < MAX_SKIPPED_EMPTY_PACKETS; skipped++) {
      packet = await this.#bulkIn(this.#bulkinPacketSize, timeout);
    }
    return packet;
  }

  /** True for a DEV_DEP_MSG_IN that answers a request that was given up (not the current one). */
  #isAbandonedAnswer(packet, expectedTag) {
    if (packet.byteLength < HEADER_SIZE || packet.getUint8(0) !== MSGID_DEV_DEP_MSG_IN) {
      return false;
    }
    const tag = packet.getUint8(1);
    return tag !== expectedTag && packet.getUint8(2) === (~tag & 0xFF) && this.#abandonedTags.has(tag);
  }

  /** Reads the rest of a message whose first packet is `first` and throws it away. */
  async #skipMessage(first, timeout) {
    const transferSize = first.getUint32(4, true);
    let received = Math.min(first.byteLength - HEADER_SIZE, transferSize);
    while (received < transferSize) {
      const chunk = await this.#bulkIn(this.#bulkinPacketSize, timeout);
      if (chunk.byteLength === 0) {
        throw new UsbtmcProtocolError('Unexpected empty Bulk-IN packet');
      }
      received += chunk.byteLength;
    }
  }

  /** Reads exactly `length` bytes, possibly across several messages. */
  async #readExactly(length, timeout) {
    const data = new Uint8Array(length);
    let received = 0;
    let eom = false;
    while (received < length) {
      const message = await this.#readMessage(length - received, timeout);
      if (message.data.length === 0) {
        throw new UsbtmcProtocolError('Empty DEV_DEP_MSG_IN while reading ' + length + ' bytes');
      }
      data.set(message.data, received);
      received += message.data.length;
      eom = message.eom;
      if (eom && received < length) {
        throw new UsbtmcProtocolError('Message ended after ' + received + ' of ' + length + ' bytes');
      }
    }
    return { data: data, eom: eom };
  }

  #concat(chunks, total) {
    if (chunks.length === 1) {
      return chunks[0];
    }
    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  }

  // -------------------------------------------------------------------------
  // Bulk transfers
  // -------------------------------------------------------------------------

  async #transmit(msgId, transferSize, attributes, termChar, payload) {
    const payloadLength = payload ? payload.length : 0;
    // The message is padded to a multiple of 4 bytes.
    const size = (HEADER_SIZE + payloadLength + 3) & ~3;
    const message = new Uint8Array(size);
    const view = new DataView(message.buffer);
    const tag = this.#bulkoutbTag;

    message[0] = msgId;
    message[1] = tag;
    message[2] = ~tag & 0xFF;
    message[3] = 0x00;
    view.setUint32(4, transferSize, true);
    message[8] = attributes;
    message[9] = termChar;
    if (payload) {
      message.set(payload, HEADER_SIZE);
    }

    let result;
    try {
      result = await this.#device.transferOut(this.#bulkoutEndpointNum, message);
    } catch (error) {
      throw new UsbtmcError('Bulk-OUT transfer failed', { cause: error });
    }
    if (result.status != 'ok') {
      if (result.status == 'stall') {
        await this.#clearHalt('out', this.#bulkoutEndpointNum);
      }
      throw new UsbtmcError('Bulk-OUT transfer failed (' + result.status + ')');
    }

    this.#lastbulkoutbTag = tag;
    this.#bulkoutbTag++;
    if (this.#bulkoutbTag >= 256) {
      // The Host must set bTag such that 1<=bTag<=255.
      this.#bulkoutbTag = 1;
    }
  }

  /**
   * One Bulk-IN transfer. If it does not complete within `timeout` ms,
   * INITIATE_ABORT_BULK_IN is performed and UsbtmcTimeoutError is thrown.
   */
  async #bulkIn(length, timeout) {
    const result = await this.#bulkInRaw(length, timeout);

    if (result === TIMED_OUT) {
      const error = new UsbtmcTimeoutError('Bulk-IN transfer timed out after ' + timeout + ' ms');
      try {
        await this.#abortBulkIn();
      } catch (abortError) {
        error.cause = abortError;
      }
      throw error;
    }

    if (result.status != 'ok') {
      if (result.status == 'stall') {
        await this.#clearHalt('in', this.#bulkinEndpointNum);
      }
      throw new UsbtmcError('Bulk-IN transfer failed (' + result.status + ')');
    }
    return result.data;
  }

  /** Bulk-IN without abort handling. Resolves to TIMED_OUT on timeout. */
  async #bulkInRaw(length, timeout) {
    return await this.#receiveIn(this.#bulkinEndpointNum, length, timeout, 'Bulk-IN transfer failed');
  }

  /**
   * IN transfer that resolves to TIMED_OUT after `timeout` ms.
   *
   * A WebUSB transfer cannot be cancelled. One that timed out stays queued in the host
   * stack and takes the next packet the device sends, even though nobody waits for it
   * any more. So it is kept and handed to the next reader (whether or not it has
   * settled by then) instead of issuing a second transfer.
   */
  async #receiveIn(endpointNumber, length, timeout, failureMessage) {
    let promise = this.#pendingIn.get(endpointNumber);
    if (!promise) {
      promise = this.#device.transferIn(endpointNumber, length);
      this.#pendingIn.set(endpointNumber, promise);
    }

    let result;
    try {
      result = await this.#withTimeout(promise, timeout, failureMessage);
    } catch (error) {
      this.#pendingIn.delete(endpointNumber);
      throw error;
    }
    if (result !== TIMED_OUT) {
      this.#pendingIn.delete(endpointNumber);
    }
    return result;
  }

  async #withTimeout(promise, timeout, failureMessage) {
    let timer;
    const timedOut = new Promise((resolve) => {
      timer = setTimeout(resolve, timeout, TIMED_OUT);
    });
    try {
      const result = await Promise.race([promise, timedOut]);
      if (result === TIMED_OUT) {
        // The transfer may still settle later; nobody is waiting for it.
        promise.catch(() => { });
      }
      return result;
    } catch (error) {
      throw new UsbtmcError(failureMessage, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }

  async #clearHalt(direction, endpointNumber) {
    try {
      await this.#device.clearHalt(direction, endpointNumber);
    } catch (error) {
      // Report the original transfer failure instead.
    }
  }

  /** Reads Bulk-IN until a short packet (or silence) is seen. Returns true if something was read. */
  async #drainBulkIn() {
    const startedAt = Date.now();
    let readAny = false;
    while (Date.now() - startedAt < DRAIN_LIMIT_MS) {
      let result;
      try {
        result = await this.#bulkInRaw(this.#bulkinPacketSize, DRAIN_TIMEOUT_MS);
      } catch (error) {
        return readAny;
      }
      if (result === TIMED_OUT || result.status != 'ok') {
        return readAny;
      }
      readAny = true;
      if (result.data.byteLength < this.#bulkinPacketSize) {
        return readAny;
      }
    }
    return readAny;
  }

  /**
   * A session that ended with an answer that was not read (for example after a timeout) leaves it in
   * the instrument. The first request of the next session would get that answer, with the wrong bTag.
   * So whatever is waiting is read and thrown away before the first request. When nothing is waiting,
   * the transfer that was started stays queued and goes to the first reader.
   */
  async #discardStaleAnswers() {
    for (let i = 0; i < MAX_STALE_ANSWERS && await this.#drainBulkIn(); i++) {
      // each round throws away one message
    }
  }

  async #abortBulkIn() {
    const endpointAddress = 0x80 | this.#bulkinEndpointNum;

    let data = await this.#controlIn('INITIATE_ABORT_BULK_IN', 'endpoint', REQ_INITIATE_ABORT_BULK_IN, this.#lastbulkoutbTag, endpointAddress, 2);
    let status = data.getUint8(0);

    if (status == STATUS_SUCCESS) {
      // The Host should continue reading from the Bulk-IN endpoint until a short packet is received.
      await this.#drainBulkIn();
    } else if (status == STATUS_TRANSFER_NOT_IN_PROGRESS) {
      // The Host must not send CHECK_ABORT_BULK_IN_STATUS.
      throw new UsbtmcProtocolError('INITIATE_ABORT_BULK_IN: transfer not in progress');
    } else if (status == STATUS_FAILED) {
      // The Host must not send CHECK_ABORT_BULK_IN_STATUS.
      throw new UsbtmcProtocolError('INITIATE_ABORT_BULK_IN failed');
    } else {
      throw new UsbtmcProtocolError('INITIATE_ABORT_BULK_IN: unexpected status 0x' + status.toString(16));
    }

    for (let i = 0; i < MAX_POLLS; i++) {
      data = await this.#controlIn('CHECK_ABORT_BULK_IN_STATUS', 'endpoint', REQ_CHECK_ABORT_BULK_IN_STATUS, 0, endpointAddress, 8, 2);
      status = data.getUint8(0);

      if (status != STATUS_PENDING) {
        // The Host must send a USBTMC command message that expects a response before sending another Bulk-IN transaction.
        return;
      }

      // USBTMC_STATUS_PENDING: send CHECK_ABORT_BULK_IN_STATUS at a later time.
      // If bmAbortBulkIn.D0 = 1, the Host should read from the Bulk-IN endpoint until a short packet is received.
      if ((data.getUint8(1) & 0x01) == 0x01) {
        await this.#drainBulkIn();
      } else {
        await this.delay(POLL_INTERVAL_MS);
      }
    }

    throw new UsbtmcProtocolError('CHECK_ABORT_BULK_IN_STATUS stayed pending');
  }

  // -------------------------------------------------------------------------
  // Control requests
  // -------------------------------------------------------------------------

  /**
   * Class-specific IN control request. Returns a DataView with at least
   * `minLength` bytes. For recipient 'interface' `index` is the interface
   * number; for 'endpoint' it is the endpoint address.
   */
  async #controlIn(name, recipient, request, value, index, length, minLength = 1) {
    this.#assertOpened();

    let result;
    try {
      result = await this.#device.controlTransferIn({
        'requestType': 'class',
        'recipient': recipient,
        'request': request,
        'value': value,
        'index': index
      }, length);
    } catch (error) {
      throw new UsbtmcError(name + ' failed', { cause: error });
    }

    if (result.status != 'ok' || !result.data || result.data.byteLength < minLength) {
      throw new UsbtmcError(name + ' failed (' + result.status + ')');
    }
    return result.data;
  }

  #expectSuccess(name, status) {
    if (status != STATUS_SUCCESS) {
      throw new UsbtmcProtocolError(name + ' failed, status = 0x' + status.toString(16));
    }
  }

  #assertOpened() {
    if (!this.opened) {
      throw new UsbtmcError('Device is not open');
    }
  }

  async readStatusByteRegister() {
    const data = await this.#controlIn('READ_STATUS_BYTE', 'interface', REQ_READ_STATUS_BYTE, this.#rtbbTag, this.#interfaceNumber, 3, 3);

    this.#expectSuccess('READ_STATUS_BYTE', data.getUint8(0));
    if (data.getUint8(1) != this.#rtbbTag) {
      throw new UsbtmcProtocolError('READ_STATUS_BYTE: bTag mismatch');
    }

    const currentRtbbTag = this.#rtbbTag;
    this.#rtbbTag++;
    if (this.#rtbbTag > 127)
      this.#rtbbTag = 2;

    if (this.#interruptinEndpointNum == -1) {
      return data.getUint8(2);
    }

    const result = await this.#receiveIn(this.#interruptinEndpointNum, 2, 1000, 'Interrupt-IN transfer failed');
    if (result === TIMED_OUT) {
      throw new UsbtmcTimeoutError('Interrupt-IN transfer timed out');
    }
    if (result.status != 'ok' || result.data.byteLength < 2) {
      throw new UsbtmcProtocolError('Interrupt-IN response is too short');
    }

    const number = result.data.getUint8(0);
    const rtbbTag = number & 0x007F;

    if ((number & 0x80) != 0x80 ||      // Must be 1.
      rtbbTag != currentRtbbTag) {      // The bTag value must be the same as the bTag value in the READ_STATUS_BYTE request.
      throw new UsbtmcProtocolError('Interrupt-IN response does not match READ_STATUS_BYTE');
    }

    return result.data.getUint8(1);
  }

  async clear() {
    this.#assertOpened();

    let data = await this.#controlIn('INITIATE_CLEAR', 'interface', REQ_INITIATE_CLEAR, 0, this.#interfaceNumber, 1);
    this.#expectSuccess('INITIATE_CLEAR', data.getUint8(0));
    this.#abandonedTags.clear();   // the device drops the answers that were still to come

    let completed = false;
    for (let i = 0; i < MAX_POLLS && !completed; i++) {
      data = await this.#controlIn('CHECK_CLEAR_STATUS', 'interface', REQ_CHECK_CLEAR_STATUS, 0, this.#interfaceNumber, 2, 2);

      if (data.getUint8(0) == STATUS_PENDING) {
        // If bmClear.D0 = 1, the Host should read from the Bulk-IN endpoint until a short packet is received.
        // The Host must send CHECK_CLEAR_STATUS at a later time.
        if ((data.getUint8(1) & 0x01) == 0x01) {
          await this.#drainBulkIn();
        } else {
          await this.delay(POLL_INTERVAL_MS);
        }
      } else {
        this.#expectSuccess('CHECK_CLEAR_STATUS', data.getUint8(0));
        completed = true;
      }
    }

    if (!completed) {
      throw new UsbtmcProtocolError('CHECK_CLEAR_STATUS stayed pending');
    }

    await this.delay(100);   // Wait xxx ms before sending CLEAR_FEATURE

    // The Host must send a CLEAR_FEATURE request to clear the Bulk-OUT Halt.
    await this.#device.clearHalt('out', this.#bulkoutEndpointNum);
  }

  // --start-- IEEE 488.2: Arbitrary Block data

  async writeBlockData(command, bytes) {
    if (command == undefined || command == '') {
      throw new UsbtmcError('Command is empty');
    }
    if (bytes.length > 999999999) {
      throw new UsbtmcError('Block data is too large');
    }

    const textEncoder = new TextEncoder();

    // SCPI
    const scpi = textEncoder.encode(command + ' ');

    // # is 1 byte
    const stc = textEncoder.encode('#');

    // byteCount is numDigits bytes
    const byteCountText = bytes.length.toString();
    const byteCount = textEncoder.encode(byteCountText);

    // numDigits is 1 byte
    const numDigits = textEncoder.encode(byteCountText.length.toString());

    // NL is 1 byte
    const etc = textEncoder.encode('\n');

    // Construct complete scpi commands
    const newBytes = new Uint8Array(scpi.length + stc.length + numDigits.length + byteCount.length + bytes.length + etc.length);

    let offset = 0;
    newBytes.set(scpi, offset);
    offset += scpi.length;
    newBytes.set(stc, offset);
    offset += stc.length;
    newBytes.set(numDigits, offset);
    offset += numDigits.length;
    newBytes.set(byteCount, offset);
    offset += byteCount.length;
    newBytes.set(bytes, offset);
    offset += bytes.length;
    newBytes.set(etc, offset);

    await this.writeBytes(newBytes);
  }

  /**
   * Reads "#<n><length><data>" and returns <data>. The indefinite length
   * format ("#0") is not supported. Throws on failure.
   */
  async readBlockData(timeout = 5000) {
    this.#assertOpened();

    const textDecoder = new TextDecoder();

    // Skip anything in front of '#'.
    let found = false;
    for (let retry = 0; retry < MAX_POLLS && !found; retry++) {
      const message = await this.#readMessage(1, timeout);
      if (message.data.length === 0) {
        throw new UsbtmcProtocolError('No block header in the response');
      }
      found = message.data[0] === 0x23;   // '#'
    }
    if (!found) {
      throw new UsbtmcProtocolError('Block header "#" not found');
    }

    const digitLength = parseInt(textDecoder.decode((await this.#readExactly(1, timeout)).data));
    if (!Number.isInteger(digitLength) || digitLength < 1) {
      throw new UsbtmcProtocolError('Invalid or unsupported block header (digit length)');
    }

    const totalBytes = parseInt(textDecoder.decode((await this.#readExactly(digitLength, timeout)).data));
    if (!Number.isInteger(totalBytes) || totalBytes < 0) {
      throw new UsbtmcProtocolError('Invalid block header (byte count)');
    }

    let content = { data: new Uint8Array(0), eom: false };
    if (totalBytes > 0) {
      content = await this.#readExactly(totalBytes, timeout);
    }

    // Consume the remaining data (e.g. the terminator) up to EOM.
    if (!content.eom) {
      try {
        await this.#readMessage(64, DRAIN_TIMEOUT_MS);
      } catch (error) {
        if (!(error instanceof UsbtmcTimeoutError)) {
          throw error;
        }
      }
    }

    return content.data;
  }

  // --end-- IEEE 488.2: Arbitrary Block data

}

// Enables `await using tmc = new Webusbtmc()` where the runtime supports it.
if (typeof Symbol.asyncDispose === 'symbol') {
  Webusbtmc.prototype[Symbol.asyncDispose] = function () {
    return this.close();
  };
}

export default Webusbtmc;
