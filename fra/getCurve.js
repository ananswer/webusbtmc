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

  ReadList(data) {
    if (typeof data !== 'string') return [];

    const trimmed = data.trim();

    if (trimmed === '' || trimmed === '+0') return [];
  
    const nums = trimmed.split(',').map(Number);
    if (nums.some(isNaN)) {
      console.warn('ReadList: invalid numeric data', data);
      return [];
    }
    
    return nums;
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
      result = await this.fetch_keysight();
      result.isSupported = true;
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

  async fetch_keysight() {

    if(this.#isBusy) {
      return { data_ch1: [], data_ch2: [], length: NaN, rate: NaN };
    }

    this.#isBusy = true;

    await this.#tmc.write(':STOP');
    await this.#tmc.delay(100);

    const result = await this.fetch_procedure_keysight();

    await this.#tmc.write(':RUN');

    this.#isBusy = false;

    return { data_ch1: result.data_ch1, data_ch2: result.data_ch2, length: result.data_ch1.length, rate: result.rate };
  }


  async fetch_procedure_keysight() {
    let tmp;
    let raw;
    let buff;
    let preamble;

    let yoff;
    let ymult;
    let yorgn;

    let rate;

    await this.#tmc.write(':WAV:SOUR CHANnel1');
    await this.#tmc.write(':WAV:SOUR?');
    tmp = await this.#tmc.read();

    await this.#tmc.write(':WAVeform:PREamble?');
    tmp = await this.#tmc.read();

    if (tmp === '+0') {
      return { data_ch1: [], data_ch2: [], length: NaN, rate: NaN };
    }

    preamble = this.ReadList(tmp);

    let [
      intFormat,
      intType,
      lngPoints,
      lngCount,
      dblXIncrement,
      dblXOrigin,
      lngXReference,
      sngYIncrement,
      sngYOrigin,
      lngYReference
    ] = preamble;

    if (intFormat !== 0.0) {
      await this.#tmc.write(':WAV:FORM BYTE');
      return { data_ch1: [], data_ch2: [], length: NaN, rate: NaN };
    }

    rate = 1/dblXIncrement;
    yoff = lngYReference;
    ymult =sngYIncrement;
    yorgn = sngYOrigin;

    await this.#tmc.write(':WAV:DATA?');
    raw = await this.#tmc.readBlockData();
    buff = new Uint8Array(raw.buffer);

    let data_ch1 = [];
    for (let i = 0; i < buff.length; i++) {
      data_ch1.push(((buff[i] - yoff) * ymult) + yorgn);
    }

    await this.#tmc.write(':WAV:SOUR CHANnel2');
    await this.#tmc.write(':WAV:SOUR?');
    tmp = await this.#tmc.read();

    await this.#tmc.write(':WAVeform:PREamble?');
    tmp = await this.#tmc.read();

    if (tmp === '+0') {
      return { data_ch1: [], data_ch2: [], length: NaN, rate: NaN };
    }

    preamble = this.ReadList(tmp);

    [
      intFormat,
      intType,
      lngPoints,
      lngCount,
      dblXIncrement,
      dblXOrigin,
      lngXReference,
      sngYIncrement,
      sngYOrigin,
      lngYReference
    ] = preamble;

    rate = 1/dblXIncrement;
    yoff = lngYReference;
    ymult =sngYIncrement;
    yorgn = sngYOrigin;

    await this.#tmc.write(':WAV:DATA?');
    raw = await this.#tmc.readBlockData();
    buff = new Uint8Array(raw.buffer);

    let data_ch2 = [];
    for (let i = 0; i < buff.length; i++) {
      data_ch2.push(((buff[i] - yoff) * ymult) + yorgn);
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