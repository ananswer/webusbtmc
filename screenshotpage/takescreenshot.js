'use strict';
import Webusbtmc from '../webusbtmc/webusbtmc.js';

class Takescreenshot {
  #tmc;

  #device;
  #identifier;

  #command;
  #delayCount;
  #isBinaryBlock;
  #imageSize;

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

  get identifier() {
    return this.#identifier;
  }

  async open(device) {
    await this.#tmc.open(device);
    this.#device = device;

    // productId
    if (this.#device.vendorId == 0x0957 ||
        this.#device.vendorId == 0x2a8d) {
        // keysight or agilent
        this.#command = ':DISPlay:DATA? PNG';
        this.#isBinaryBlock = true;
        this.#delayCount = 100;
        this.#imageSize = 0;
    }
    else if(this.#device.vendorId == 0x0699) {
        // tektronix
        this.#command = 'HARDCopy START';
        this.#isBinaryBlock = false;
        this.#delayCount = 100;
        this.#imageSize = 0x1FFFFF;   // ‭2,097,151‬ byte
    }
    else if(this.#device.vendorId == 0x1AB1) {
        // rigol
        this.#command = ':DISPlay:DATA? ON,OFF,PNG';
        this.#isBinaryBlock = true;
        this.#delayCount = 100;
        this.#imageSize = 0;
    }
    else {
      // unknown
      this.#command = '';
      this.#isBinaryBlock = true;
      this.#delayCount = 100;
      this.#imageSize = 0;
    }

    await this.#tmc.write('*IDN?');
    await this.#tmc.delay(100);
    this.#identifier = await this.#tmc.read();
    
  }

  async close() {
    await this.#tmc.close();
    this.#device = null;
  }

  async capture() {
    if(!this.#command) {
      throw new Error('Not supported device');
    }

    await this.#tmc.write(this.#command);

    await this.#tmc.delay(this.#delayCount);

    let image;
    if(this.#isBinaryBlock == true) {
        image = await this.#tmc.readBlockData();
    } else {
        image = await this.#tmc.readBytes(this.#imageSize);
    }

    return image;
  }

}

export default Takescreenshot;