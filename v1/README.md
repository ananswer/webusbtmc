# webusbtmc v1

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
  await tmc.write('*IDN?');
  await tmc.delay(100); // wait 100 ms, just in case
  const result = await tmc.read();
  console.log(result);
  await tmc.close();
}
~~~

## Practical examples
This repository contains practical examples using WebUSBTMC.

### WebUSBTMC Test Panel
[WebUSBTMC Test Panel](basiciopage) is inspired by the "NI-VISA Interactive Control App".  
It allows you to quickly check connectivity with your instruments.

### WebUSBTMC with Blockly
[WebUSBTMC with Blockly](blocklypage) provides the simplest and easiest way to control your instruments.  
You can write automation programs with [Blockly](https://developers.google.com/blockly) and run them in a browser sandbox using the [JS-Interpreter](https://neil.fraser.name/software/JS-Interpreter/docs.html).

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
