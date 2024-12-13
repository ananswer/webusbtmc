'use strict';
import Webusbtmc from '../webusbtmc/webusbtmc.js';

class GetCurve {
  #tmc;

  #device;

  #isBusy;

  constructor() {
    this.#tmc = new Webusbtmc();
    this.#device = null;
    this.#isBusy = false;
  }

  get device() {
    return this.#device;
  }

  get opened() {
    return this.#tmc.opened;
  }

  get IsBusy() {
    return this.#isBusy;
  }

  async open(device) {
    await this.#tmc.open(device);
    this.#device = device;
    this.#isBusy = false;
  }

  async close() {
    await this.#tmc.close();
    this.#device = null;
    this.#isBusy = false;
  }

  async fetch() {
    let result = { data_ch1: [], data_ch2: [], length: NaN, rate: NaN, isSupported: false };

    // vendorId
    if (this.#device.vendorId == 0x0957 ||
      this.#device.vendorId == 0x2a8d) {
      // Agilent Technologies, Inc.
      // Keysight Technologies Inc.
    }
    else if (this.#device.vendorId == 0x0699) {
      // Tektronix, Inc.
      result = await this.fetch_tektronix();
      result.isSupported = true;
    }

    return result;
  }

  async fetch_tektronix() {
    let tmp;
    let raw;
    let int8Array;

    let yoff;
    let ymult;

    if(this.#isBusy) {
      return { data_ch1: [], data_ch2: [], length: NaN, rate: NaN };
    }

    this.#isBusy = true;

    await this.#tmc.write('HORizontal:SAMPLERate?');
    const rate = await this.#tmc.read();

    await this.#tmc.write('HORizontal:RECOrdlength?');
    const len = await this.#tmc.read();

    await this.#tmc.write('DAT:STAR 10');
    await this.#tmc.write('DAT:STOP ' + len);

    await this.#tmc.write('DATa:SOUrce CH1');

    await this.#tmc.write('CURV?');
    raw = await this.#tmc.readBlockData();
    int8Array = new Int8Array(raw.buffer);

    await this.#tmc.write('WFMOutpre:YOFf?');
    tmp = await this.#tmc.read();
    yoff = parseFloat(tmp);

    await this.#tmc.write('WFMOutpre:YMUlt?');
    tmp = await this.#tmc.read();
    ymult = parseFloat(tmp);

    let data_ch1 = [];
    for (let i = 0; i < int8Array.length; i++) {
      data_ch1.push((int8Array[i] - yoff) * ymult);
    }

    await this.#tmc.write('DATa:SOUrce CH2');

    await this.#tmc.write('CURV?');
    raw = await this.#tmc.readBlockData();
    int8Array = new Int8Array(raw.buffer);

    await this.#tmc.write('WFMOutpre:YOFf?');
    tmp = await this.#tmc.read();
    yoff = parseFloat(tmp);

    await this.#tmc.write('WFMOutpre:YMUlt?');
    tmp = await this.#tmc.read();
    ymult = parseFloat(tmp);

    let data_ch2 = [];
    for (let i = 0; i < int8Array.length; i++) {
      data_ch2.push((int8Array[i] - yoff) * ymult);
    }

    this.#isBusy = false;

    if(data_ch1.length !== data_ch2.length) {
      return { data_ch1: [], data_ch2: [], length: NaN, rate: NaN };
    }

    return { data_ch1: data_ch1, data_ch2: data_ch2, length: data_ch1.length, rate: rate };
  }

  async fetchDeviceInfo(delay = 1000) {
    await this.#tmc.write('*IDN?');
    await this.#tmc.delay(delay);
    return await this.#tmc.read();
  }

}

export default GetCurve;