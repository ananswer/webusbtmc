'use strict';
import Webusbtmc from '../webusbtmc/webusbtmc.js';

class Takescreenshot {
  #tmc;

  #device;
  #identifier;

  #command;
  #delay;
  #isBinaryBlock;

  constructor() {
    this.#tmc = new Webusbtmc();
  }

  get device() {
    return this.#device;
  }

  get command() {
    return this.#command;
  }

  set command(text) {
    this.#command = text;
  }

  get delay() {
    return this.#delay;
  }

  set delay(text) {
    this.#delay = text;
  }

  get isBinaryBlock() {
    return this.#isBinaryBlock;
  }

  set isBinaryBlock(value) {
    this.#isBinaryBlock = value;
  }

  get opened() {
    return this.#tmc.opened;
  }

  get identifier() {
    return this.#identifier;
  }

  async open(device) {
    await this.#tmc.open(device);
    this.#device = device;

    // vendorId
    if (this.#device.vendorId == 0x0957 ||
      this.#device.vendorId == 0x2a8d) {
      // Agilent Technologies, Inc.
      // Keysight Technologies Inc.
      this.#command = ':DISPlay:DATA? PNG';
      this.#isBinaryBlock = true;
      this.#delay = 100;
    }
    else if (this.#device.vendorId == 0x0699) {
      // Tektronix, Inc.
      this.#command = 'HARDCopy START';
      this.#isBinaryBlock = false;
      this.#delay = 100;

      await this.#tmc.delay(100);
      await this.#tmc.clear();
    }
    else if (this.#device.vendorId == 0x1AB1) {
      // Rigol Technologies, Inc
      this.#command = ':DISPlay:DATA? ON,OFF,PNG';
      this.#isBinaryBlock = true;
      this.#delay = 100;
    }
    else if (this.#device.vendorId == 0x0B21) {
      // Yokogawa Electric Corporation
      this.#command = ':IMAGe:SEND?';
      this.#isBinaryBlock = true;
      this.#delay = 100;
    }
    else if (this.#device.vendorId == 0x0AAD) {
      // Rohde & Schwarz GmbH & Co. KG
      this.#command = 'HCOP:DATA?';
      this.#isBinaryBlock = true;
      this.#delay = 100;
    }
    else if (this.#device.vendorId == 0x05FF) {
      // LeCroy Corporation
      this.#command = 'SCDP';
      this.#isBinaryBlock = false;
      this.#delay = 100;

      // How to Capture Screen Images Remotely? - Teledyne LeCroy
      await this.#tmc.delay(100);
      await this.#tmc.write('HCSU DEV, PNG, PORT, NET, AREA, DSOWINDOW');
    }
    else {
      // unknown
      this.#command = '';
      this.#isBinaryBlock = true;
      this.#delay = 200;
    }

    await this.#tmc.delay(100);
    await this.#tmc.write('*IDN?');
    await this.#tmc.delay(100);

    let status = await this.#tmc.readStatusByteRegister();
    if ((status & 0x10) === 0) {
      this.#identifier = 'Cannot read identifier';
    }
    else {
      this.#identifier = await this.#tmc.read();
    }
  }

  async close() {
    await this.#tmc.close();
    this.#device = null;
  }

  async capture() {
    let image;

    if (!this.#command) {
      throw new Error('Not supported device');
    }

    await this.#tmc.write(this.#command);

    await this.#tmc.delay(this.#delay);

    if (this.#isBinaryBlock) {
      image = await this.#tmc.readBlockData();
    } else {
      image = await this.#tmc.readBytes(0x1FFFFF);
    }

    return image;
  }

}

export default Takescreenshot;