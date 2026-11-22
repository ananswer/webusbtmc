# webusbtmc v2

## A code example
You can read identifying information from an instrument using the following code:
~~~javascript
import Webusbtmc from './webusbtmc/webusbtmc.js';

async function funcAsync() {
  const tmc = new Webusbtmc();
  const filters = [
    { 'classCode': 0xFE, 'subclassCode': 0x03, 'protocolCode': 0x01 },
  ];
  const device = await navigator.usb.requestDevice({ 'filters': filters });
  await tmc.open(device);
  try {
    console.log(await tmc.query('*IDN?'));
  } finally {
    await tmc.close();
  }
}
~~~

## Practical examples
This repository contains practical examples using WebUSBTMC.

### WebUSBTMC Test Panel
[WebUSBTMC Test Panel](basiciopage) is inspired by the "NI-VISA Interactive Control App".  
It allows you to quickly check connectivity with your instruments.

### Take a Screenshot
[Take a Screenshot](screenshotpage) is the easiest way to capture screenshots from your instruments.  
You don't need additional flash drives. You can view the screenshots immediately and save them.

### WebUSBTMC with SpeechRecognition
[WebUSBTMC with SpeechRecognition](speechrecognitionpage) is a voice control app using the SpeechRecognition API.

### Unlock USB Modular Devices
[Unlock USB Modular Devices](unlockusbmodular) is a supplemental tool.  
Some Keysight (or Agilent) USB modular instruments remain in "firmware update" mode at power-on. This app can switch them from "firmware update" mode to USBTMC mode.

### Frequency Response Analysis
[Frequency Response Analysis](fra) allows you to communicate with an oscilloscope and plot Bode and Nyquist diagrams directly in the browser.  
This tool is particularly useful for analyzing the frequency response of systems without requiring additional software or setup.

### DMM Logger
[DMM Logger](dmmlogger) records the readings of one or two DMMs (Keysight / Agilent) at a steady interval and draws them as they come.  
The readings can be saved as a CSV file, and a CSV file of the logger can be opened again to look at it, with or without a DMM.

## Changes from v1
`webusbtmc/webusbtmc.js` has breaking changes.

- Failures throw instead of returning `null` or an empty value.
  `UsbtmcError` is the base class; `UsbtmcTimeoutError` and `UsbtmcProtocolError` are subclasses (all exported by `webusbtmc.js`).
- `timeout` applies to each Bulk-IN transfer. On timeout the transfer is aborted and `UsbtmcTimeoutError` is thrown.
- `read()` / `readBytes()` check the response header and keep requesting until EOM or `length` bytes.
- `readBlockData()` returns the data or throws.
- Control requests use the USBTMC interface number as `wIndex`.
- `bcdUSBTMC` and `bcdUSB488` are decoded as little endian (`0x0100` for 1.00).
- `query(text)` was added. `send`, `request`, `transmit`, `receive` and `abortBulkIn` are no longer public.
- `open()` throws if a device is already open.
- `await using tmc = new Webusbtmc()` closes the device when the runtime supports it.

## Tests
The driver is tested against a fake `USBDevice`, the frequency response analysis with synthetic waves, and the DMM logger (readings, CSV file, loop with a virtual clock) without instruments (Node.js 20 or later):

~~~
cd v2
node --test
~~~
