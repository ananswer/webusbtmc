'use strict';
import Webusbtmc from '../webusbtmc/webusbtmc.js';

class Takescreenshot {
  #tmc;

  #device;

  #command;
  #delay;
  #isBinaryBlock;
  #isTekSpecialDeviceDetected;

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
      this.#isTekSpecialDeviceDetected = false;
      if ((this.#device.productId == 0x0105) ||
        (this.#device.productId == 0x0522)) {
          // Tek 2 and 5 series MSO
          this.#isTekSpecialDeviceDetected = true;
          this.#command = 'No command';
          this.#isBinaryBlock = false;
          this.#delay = 200;
  
      }
      else {
        this.#command = 'HARDCopy START';
        this.#isBinaryBlock = false;
        this.#delay = 100;
  
        await this.#tmc.delay(100);
        await this.#tmc.clear();
      }
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

  }

  async close() {
    await this.#tmc.close();
    this.#device = null;
  }

  async capture() {
    let status;
    let image;

    if (this.#isTekSpecialDeviceDetected) {

      status = await this.#tmc.readStatusByteRegister();
      if ((status & 0x10) !== 0) {
        await this.#tmc.readBytes(1024*1024);
      }

      await this.#tmc.write('SAVE:IMAGe \"C:/tmp000.png\"');

      await this.#tmc.delay(this.#delay);

      await this.#tmc.write('FILESystem:READFile \"C:/tmp000.png\"');

      await this.#tmc.delay(100);

      status = await this.#tmc.readStatusByteRegister();
      if ((status & 0x10) === 0) {
        return undefined;
      }

      image = await this.#tmc.readBytes(1024*1024);

      // Even after the trasnfer is complete, if "0x0A" remains in the receive buffer. 
      await this.#tmc.readBytes(1024*1024);

    }
    else {
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

    }

    return image;
  }

  async fetchDeviceInfo(delay = 1000) {
    await this.#tmc.write('*IDN?');
    await this.#tmc.delay(delay);
    return await this.#tmc.read();
  }

}

export default Takescreenshot;