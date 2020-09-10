/**
 * Copyright (C) Naoya Imai
 *
 * Licensed under Apache 2.0
 * 
 * USBTMC on WebUSB API
 */

'use strict';
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

  #bulkinEndpointNum;
  #bulkinPacketSize;
  #bulkoutEndpointNum;
  #bulkoutPacketSize;
  #interruptinEndpointNum;
  #interruptinPacketSize;

  #terminatorWrite;
  #terminatorRead;

  constructor() {
    this.#bcdUSBTMC = -1;
    this.#usbtmcInterfaceCapabilities = -1;
    this.#usbtmcDeviceCapabilities = -1;
    this.#bcdUSB488 = -1;
    this.#usb488InterfaceCapabilities = -1;
    this.#usb488DeviceCapabilities = -1;
    this.#lastbulkoutbTag = 1;
    this.#bulkoutbTag = 1;
    this.#rtbbTag = 2;

    this.#bulkinEndpointNum = -1;
    this.#bulkinPacketSize = 64;
    this.#bulkoutEndpointNum = -1;
    this.#bulkoutPacketSize = 64;
    this.#interruptinEndpointNum = -1;
    this.#interruptinPacketSize = 64;

    this.#terminatorWrite = '\n';
    this.#terminatorRead = '\n';
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

  delay(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms, 'done'));
  }

  async open(device) {
    let interfaceNumber = 0;
    let alternateSetting = 0;
    this.#bulkinEndpointNum = -1;
    this.#bulkoutEndpointNum = -1;
    this.#interruptinEndpointNum = -1;

    await device.open();

    this.#device = device;

    const configurationInterfaces = this.#device.configuration.interfaces;
    configurationInterfaces.forEach((element) => {
      element.alternates.forEach((elementalt) => {
        if (elementalt.interfaceClass==0xfe && elementalt.interfaceSubclass==0x03 && elementalt.interfaceProtocol==0x01) {
          interfaceNumber = element.interfaceNumber;
          alternateSetting = elementalt.alternateSetting;

          elementalt.endpoints.forEach((elementendpoint) => {
            if (elementendpoint.type == 'bulk') {
              if (elementendpoint.direction == 'out') {
                this.#bulkoutEndpointNum = elementendpoint.endpointNumber;
                this.#bulkoutPacketSize = elementendpoint.packetSize
              } else if (elementendpoint.direction=='in') {
                this.#bulkinEndpointNum =elementendpoint.endpointNumber;
                this.#bulkinPacketSize = elementendpoint.packetSize
              }
            } else if (elementendpoint.type == 'interrupt') {
              if (elementendpoint.direction=='in') {
                this.#interruptinEndpointNum =elementendpoint.endpointNumber;
                this.#interruptinPacketSize = elementendpoint.packetSize
              }
            }
          });
        }
      });
    });

    await this.#device.claimInterface(interfaceNumber);
    await this.#device.selectAlternateInterface(interfaceNumber, alternateSetting);

    let result = await this.#device.controlTransferIn({
      'requestType': 'class',
      'recipient': 'interface',
      'request': 0x7, // USBTMC_GET_CAPABILITIES
      'value': 0x00,
      'index': 0}, 24);

    if (result.status == 'ok' && result.data.getUint8(0) == 0x01) {
      this.#bcdUSBTMC = result.data.getUint8(2);
      this.#bcdUSBTMC = this.#bcdUSBTMC << 8;
      this.#bcdUSBTMC += result.data.getUint8(3);
      this.#usbtmcInterfaceCapabilities = result.data.getUint8(4);
      this.#usbtmcDeviceCapabilities = result.data.getUint8(5);
      this.#bcdUSB488 = result.data.getUint8(12);
      this.#bcdUSB488 = this.#bcdUSB488 << 8;
      this.#bcdUSB488 += result.data.getUint8(13);
      this.#usb488InterfaceCapabilities = result.data.getUint8(14);
      this.#usb488DeviceCapabilities = result.data.getUint8(15);
    } else {
      throw new Error('reject!!');
    }

    if ((this.#usb488DeviceCapabilities & 0x02) == 0x02) {
      // The interface accepts REN_CONTROL, GO_TO_LOCAL, and LOCAL_LOCKOUT requests.
      result = await this.#device.controlTransferIn({
        'requestType': 'class',
        'recipient': 'interface',
        'request': 160, // USBTMC_488_REN_CONTROL
        'value': 0x01,
        'index': 0}, 1);

      if (result.status != 'ok' || result.data.getUint8(0) != 0x01) {
        throw new Error('reject!!');
      }
    }
  }

  async close() {
    if ((this.#usb488DeviceCapabilities & 0x02) == 0x02) {
      await this.#device.controlTransferIn({
        'requestType': 'class',
        'recipient': 'interface',
        'request': 161, // USBTMC_488_GO_TO_LOCAL
        'value': 0x00,
        'index': 0}, 1);
  
      await this.#device.controlTransferIn({
        'requestType': 'class',
        'recipient': 'interface',
        'request': 160, // USBTMC_488_REN_CONTROL
        'value': 0x00,
        'index': 0}, 1);
    }

    await this.#device.close();
  }

  async write(text) {
    const textEncoder = new TextEncoder();
    const bytes = textEncoder.encode(text + this.#terminatorWrite);
    await this.writeBytes(bytes);
  }

  async writeBytes(bytes) {
    let currentIndex = 0;
    while (currentIndex < bytes.length) {
      const written = await this.send(bytes.slice(currentIndex));
      currentIndex += written;
    }
  }

  async read(length = 1024, timeout = 5000) {
    const bytes = await this.readBytes(length, timeout);
    const textDecoder = new TextDecoder();
    const text = textDecoder.decode(bytes);
    return text.replace(this.#terminatorRead,'');
  }

  async readBytes(length = 1024, timeout = 5000) {
    await this.request(length);
    const timeoutID = setTimeout(() => {this.abortBulkIn(this).catch((error) => {console.log(error);})}, timeout);
    const output = await this.receive();
    clearTimeout(timeoutID);
    if (!output.data) {
      console.log('receive failed');
      return null;
    }
    return output.data;
  }


  async send(src) {
    // DEV_DEP_MSG_OUT
    return await this.transmit(0x01, src.length, src);
  }


  async request(length) {
    // REQUEST_DEV_DEP_MSG_IN
    return await this.transmit(0x02, length);
  }


  async transmit(cmd, length, src = null) {
    if (this.#bulkoutEndpointNum == -1) {
      throw new Error('No appropriate endpoint for transmit');
    }

    let size = 12;
    if (src != null) {
      size += length
    }

    if (size > this.#bulkoutPacketSize) {
      size = this.#bulkoutPacketSize;
    }

    const moduloFour = size % 4;
    if (moduloFour != 0) {
      size = size - moduloFour + 4;
    }

    const message = new Uint8Array(size);

    // 0:MsgID
    message[0] = cmd;
    // 1:bTag
    message[1] = this.#bulkoutbTag;
    // 2:bTagInverse
    message[2] = ~this.#bulkoutbTag;
    // 3:Reserved(0x00)
    message[3] = 0x00;

    if (src != null) {
      // for DEV_DEP_MSG_OUT Bulk-OUT Header
      let attributes = 0x01;  // The message is the last message.
      if (length > (this.#bulkoutPacketSize -12)) {
        length = (this.#bulkoutPacketSize -12);
        attributes = 0x00;    // The message is not the last message.
      }

      // 4,5,6,7:TransferSize
      message[4] = (length >> 0)  & 0xFF;
      message[5] = (length >> 8)  & 0xFF;
      message[6] = (length >> 16) & 0xFF;
      message[7] = (length >> 24) & 0xFF;

      // 8:bmTransferAttributes
      message[8] = attributes;
      // 9:Reserved(0x00)
      message[9] = 0x00;
    } else {
      // for REQUEST_DEV_DEP_MSG_IN Bulk-OUT Header
      // 4,5,6,7:TransferSize
      message[4] = (length >> 0)  & 0xFF;
      message[5] = (length >> 8)  & 0xFF;
      message[6] = (length >> 16) & 0xFF;
      message[7] = (length >> 24) & 0xFF;

      // 8:bmTransferAttributes
      message[8] = 0x00; // The device must ignore TermChar
      // 9:TermChar
      message[9] = 0x00; // If bmTransferAttributes.D1 = 0, the device must ignore this field.
    }

    // 10,11:Reserved(0x00)
    message[10] = 0x00;
    message[11] = 0x00;

    if (src != null) {
      // Device dependent message data bytes
      message.set(src.slice(0, length), 12);
    }

    const result = await this.#device.transferOut(this.#bulkoutEndpointNum, message);

    if (result.status != 'ok' || result.bytesWritten < 0) {
      throw new Error('Cannot transferout in transmit');
    }

    this.#lastbulkoutbTag = this.#bulkoutbTag;
    this.#bulkoutbTag++;
    if (this.#bulkoutbTag >= 256) {
      // The Host must set bTag such that 1<=bTag<=255.
      this.#bulkoutbTag = 1;
    }

    return length;
  }

  
  async receive() {
    if (this.bulkinEndpointNum == -1) {
      throw new Error('No appropriate endpoint for receive');
    }

    let result = await this.#device.transferIn(this.#bulkinEndpointNum, this.#bulkinPacketSize);

    if (result.status != 'ok') {
      throw new Error('receive failed');
    }

    if (result.data.byteLength < 12) {
      console.log('Received data is unreliable');
      return { data: null, finished: true };
    }

    let response = new Uint8Array(result.data.buffer);

    // 4,5,6,7:TransferSize
    let dataSize = 0;
    dataSize =  response[7];
    dataSize =  dataSize << 8;
    dataSize += response[6];
    dataSize =  dataSize << 8;
    dataSize += response[5];
    dataSize =  dataSize << 8;
    dataSize += response[4];

    // 8:bmTransferAttributes
    let finished = false;
    if (response[8] == 0x01) {
      finished = true;
    }    

    let extraDataSize = dataSize;
    const moduloFour = dataSize % 4;
    if (moduloFour != 0) {
      extraDataSize = dataSize - moduloFour + 4;
    }

    console.log('finished =' + finished);
    console.log('dataSize =' + dataSize);
    console.log('extraDataSize =' + extraDataSize);

    const buffer = new ArrayBuffer(extraDataSize);
    const tmp = new Uint8Array(buffer);

    tmp.set(response.slice(12));

    let currentIndex = response.length - 12;

    while (currentIndex < dataSize) {
      result = await this.#device.transferIn(this.#bulkinEndpointNum, this.#bulkinPacketSize);

      if (result.status != 'ok'|| result.data.byteLength <= 0) {
        break;
      }
    
      response = new Uint8Array(result.data.buffer);
      tmp.set(response, currentIndex);

      currentIndex += response.length;
    }

    const dest = new Uint8Array(buffer, 0, dataSize);

    return { data: dest, finished: finished };
  }


  async abortBulkIn(obj = this) {
    if (obj.#bulkinEndpointNum == -1) {
      throw new Error('No appropriate endpoint for abortBulkIn');
    }

    let result = await obj.#device.controlTransferIn({
      'requestType': 'class',
      'recipient': 'endpoint',
      'request': 0x3, // USBTMC_INITIATE_ABORT_BULK_IN
      'value': obj.#lastbulkoutbTag,
      'index': (0x80 + obj.#bulkinEndpointNum)}, 2);

    if (result.status != 'ok' ) {
      throw new Error('USBTMC_INITIATE_ABORT_BULK_IN failed');
    }

    let status = result.data.getUint8(0);

    if (status == 0x01) {
      // USBTMC_STATUS_SUCCESS
      // The Host should continue reading from the Bulk-IN endpoint until a short packet is received.
      // The Host, after a short packet is received, must send CHECK_ABORT_BULK_IN_STATUS.
    } else if (status == 0x81) {
      // USBTMC_STATUS_TRANSFER_NOT_IN_PROGRESS
      // The Host must not send CHECK_ABORT_BULK_IN_STATUS.
      // The Host may send INITIATE_ABORT_BULK_IN at a later time.
      console.log('USBTMC_STATUS_TRANSFER_NOT_IN_PROGRESS');
      return;
    } else {
      // The Host must not send CHECK_ABORT_BULK_OUT_STATUS.
      // The Host must retire Bulk-IN IRP’s.
      console.log('USBTMC_INITIATE_ABORT_BULK_IN succeed, but status =' + status);
      return;
    }

    let i = 0;
    do {
      i++;
      result = await obj.#device.controlTransferIn({
        'requestType': 'class',
        'recipient': 'endpoint',
        'request': 0x4, // USBTMC_CHECK_ABORT_BULK_IN_STATUS
        'value': 0,
        'index': (0x80 + obj.#bulkinEndpointNum)}, 8);
  
      if (result.status != 'ok') {
        throw new Error('USBTMC_CHECK_ABORT_BULK_IN_STATUS failed');
      }
  
      status = result.data.getUint8(0);
      
      let nBytesTxd = 0;
      nBytesTxd = result.data.getUint8(7);
      nBytesTxd = nBytesTxd << 8;
      nBytesTxd += result.data.getUint8(6);
      nBytesTxd = nBytesTxd << 8;
      nBytesTxd += result.data.getUint8(5);
      nBytesTxd = nBytesTxd << 8;
      nBytesTxd += result.data.getUint8(4);

      if (nBytesTxd > obj.#bulkinPacketSize) {
        nBytesTxd = obj.#bulkinPacketSize;
      }

      if (status == 0x02) {
        // USBTMC_STATUS_PENDING
        // The Host must send CHECK_ABORT_BULK_IN_STATUS at a later time.
        // If bmAbortBulkIn.D0 = 1, the Host should read from the Bulk-IN endpoint until a short packet is received.
        // The Host must ignore NBYTES_TXD.
        if ((result.data.getUint8(1) & 0x01) == 0x01) {
          await obj.#device.transferIn(obj.#bulkinEndpointNum, nBytesTxd);
        } else {
          continue;
        }
      }
      else
      {
        // The Host must not send CHECK_ABORT_BULK_IN_STATUS.
        // The Host must send a USBTMC command message that expects a response before sending another Bulk-IN transaction.
        break;
      }
    } while(i < 16);
  }


  async readStatusByteRegister() {
    let result = await this.#device.controlTransferIn({
      'requestType': 'class',
      'recipient': 'interface',
      'request': 128, // USBTMC_488_READ_STATUS_BYTE
      'value': this.#rtbbTag,
      'index': 0}, 3);

    if (result.status != 'ok' || result.data.getUint8(0) != 0x01 || result.data.getUint8(1) != this.#rtbbTag) {
      throw new Error('USBTMC_488_READ_STATUS_BYTE failed');
    }

    const currentRtbbTag = this.#rtbbTag;
    this.#rtbbTag++;
    if (this.#rtbbTag > 127)
      this.#rtbbTag = 2;

    if (this.#interruptinEndpointNum == -1) {
        return result.data.getUint8(2);
    }

    let usbInTransferResult = await this.#device.transferIn(this.#interruptinEndpointNum, 2);

    if (usbInTransferResult.status != 'ok'|| usbInTransferResult.data.byteLength < 2) {
      throw new Error('readStatusByteRegister unreliable:1');
    }

    let number = usbInTransferResult.data.getUint8(0);
    let rtbbTag = number & 0x007F;

    if ((number & 0x80) != 0x80 ||      // Must be 1.
         rtbbTag != currentRtbbTag) {    // The bTag value must be the same as the bTag value in the READ_STATUS_BYTE request.
          throw new Error('readStatusByteRegister unreliable:2');
        }

    return usbInTransferResult.data.getUint8(1);
  }


  async clear() {
    if (this.#bulkinEndpointNum == -1 || this.#bulkoutEndpointNum == -1) {
      throw new Error('No appropriate endpoint for clear');
    }

    let result = await this.#device.controlTransferIn({
      'requestType': 'class',
      'recipient': 'interface',
      'request': 0x5, // USBTMC_INITIATE_CLEAR
      'value': 0,
      'index': 0}, 1);

    if (result.status != 'ok' ) {
      throw new Error('USBTMC_INITIATE_CLEAR failed');
    }

    let status = result.data.getUint8(0);

    if (status == 0x01) {
      // USBTMC_STATUS_SUCCESS
    } else {
      // The Host must not send CHECK_CLEAR_STATUS.
      console.log('USBTMC_INITIATE_CLEAR failed, status =' + status);
      return;
    }

    let i = 0;
    do {
      i++;
      result = await this.#device.controlTransferIn({
        'requestType': 'class',
        'recipient': 'interface',
        'request': 0x6, // USBTMC_CHECK_CLEAR_STATUS
        'value': 0,
        'index': 0}, 2);
  
      if (result.status != 'ok') {
        throw new Error('USBTMC_CHECK_CLEAR_STATUS failed');
      }
  
      status = result.data.getUint8(0);
      
      if (status == 0x02) {
        // USBTMC_STATUS_PENDING
        // If bmClear.D0 = 1, the Host should read from the Bulk-IN endpoint until a short packet is received.
        // The Host must send CHECK_CLEAR_STATUS at a later time.
        if ((result.data.getUint8(1) & 0x01) == 0x01) {
          await this.#device.transferIn(this.#bulkinEndpointNum, this.#bulkinPacketSize);
        } else {
          break;
        }
      }
      else
      {
        // The Host must send a CLEAR_FEATURE request to clear the Bulk-OUT Halt.
        break;
      }

    } while(i < 16);

    await this.delay(100);   // Wait xxx ms before sending CLEAR_FEATURE

    await this.#device.clearHalt('out', this.#bulkoutEndpointNum);

  }

  // --start-- IEEE 488.2: Arbitrary Block data

  async writeBlockData(command, bytes) {
    if (command == undefined || command == '') {
      throw new Error('Command is empty');
    }

    const textEncoder = new TextEncoder();
    
    // SCPI
    const scpi = textEncoder.encode(command + ' ');

    // # is 1 byte
    const stc = textEncoder.encode('#');

    // numDigits is 1 byte
    const numDigitsText = parseInt(bytes.length.toString().length).toString();
    const numDigits = textEncoder.encode(numDigitsText);

    // byteCount is numDigits bytes
    const byteCountText = bytes.length.toString();
    const byteCount = textEncoder.encode(byteCountText);

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

    let currentIndex = 0;
    while (currentIndex < newBytes.length) {
      const written = await this.send(newBytes.slice(currentIndex));
      currentIndex += written;
    }

  }


  async readBlockData(timeout = 5000) {
    const textDecoder = new TextDecoder();
    let timeoutID;
    let output;

    let retry = 0;
    do {
      await this.request(1);
      timeoutID = setTimeout(() => {this.abortBulkIn(this).catch((error) => {console.log(error);})}, timeout);
      output = await this.receive();
      clearTimeout(timeoutID);
  
      if (!output.data) {
        console.log('readBlockData failed');
        return null;
      }
  
      const stc = textDecoder.decode(output.data);
      if (stc == '#') {
        break;
      }
      retry++;

    }
    while (retry < 16)

    if (retry >= 16) {
      await this.abortBulkIn();
      console.log('Unmatch the header code in readBlockData');
      return null;
    }

    await this.request(1);
    timeoutID = setTimeout(() => {this.abortBulkIn(this).catch((error) => {console.log(error);})}, timeout);
    output = await this.receive();
    clearTimeout(timeoutID);

    if (!output.data) {
      console.log('readBlockData failed');
      return null;
    }

    const digitLength = parseInt(textDecoder.decode(output.data));

    await this.request(digitLength);
    timeoutID = setTimeout(() => {this.abortBulkIn(this).catch((error) => {console.log(error);})}, timeout);
    output = await this.receive();
    clearTimeout(timeoutID);

    if (!output.data) {
      console.log('readBlockData failed');
      return null;
    }

    const totalBytes = parseInt(textDecoder.decode(output.data));

    const buffer = new ArrayBuffer(totalBytes);
    const images = new Uint8Array(buffer);

    timeout = timeout / 10;
    let currentIndex = 0;
    while (currentIndex < totalBytes) {
      await this.request(images.length - currentIndex);
      timeoutID = setTimeout(() => {this.abortBulkIn(this).catch((error) => {console.log(error);})}, timeout);
      output = await this.receive();
      clearTimeout(timeoutID);

      if (!output.data) {
        break;
      }

      images.set(output.data, currentIndex);
      currentIndex += output.data.length;
    }

    // correct remaining data 
    timeout = 100;
    await this.request(64);
    timeoutID = setTimeout(() => {this.abortBulkIn(this).catch((error) => {console.log(error);})}, timeout);
    output = await this.receive();
    clearTimeout(timeoutID);

    return new Uint8Array(buffer, 0, totalBytes);
  }

  // --end-- IEEE 488.2: Arbitrary Block data


}

export default Webusbtmc;