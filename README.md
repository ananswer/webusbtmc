# webusbtmc
 WebUSBTMC is an usbtmc driver utilizing the WebUSB api.

## What is USBTMC?
 The USBTMC is a device class specfication to remote control test and measuremnet instruments.
 It is also used in the VISA (Virtual instrument software architecture) to communicatie with instruments over usb.


## A code example
 You can read identifying information from an instrument using the following code.
~~~javascript
  async function funcAsync() {
    const tmc = new Webusbtmc();
    const filters = [
      {'classCode': 0xFE, 'subclassCode': 0x03, 'protocolCode': 0x01},
    ];
    const device = await navigator.usb.requestDevice({'filters': filters});
    await tmc.open(device);
    await tmc.write('*IDN?');
    await tmc.delay(0.1); // just in case
    const result = await tmc.read();
    console.log(result);
    await tmc.close();
  }
~~~

## Practical examples
 This repository contains practical examples using webusbtmc.

### WebUSBTMC Test panel
 [WebUSBTMC Test panel](basiciopage) is inspired by "NI-VISA Interactive control app".
 You can check connectivity with your instruments quickly.

### WebUSBTMC with Blockly
 [WebUSBTMC with Blockly](blocklypage) is the simplest and easiest way to control your instruments.
 You can write automation program with [Blockly](https://developers.google.com/blockly) and run the program in browser sandbox using [JS-Interpreter](https://neil.fraser.name/software/JS-Interpreter/docs.html).
 
### Take a screenshot
 [Take a screenshot](screenshotpage) is the easiest way to get screenshots from your instruments.
 You don't need to extra flash drives. You can check screenshot images immediately and save it. 

## Setup
### Windows
 You need to install the WinUSB driver to your instrument with Zadig.
 If you've already install NI-VISA, Keysight IO Libraries Suite or some others, you just replace the usbtmc driver to the WinUSB driver using Zadig.  
 You can [uninstall the WinUSB driver](https://github.com/pbatard/libwdi/wiki/FAQ#Help_Zadig_replaced_the_driver_for_the_wrong_device_How_do_I_restore_it) when you want to use the original usbtmc driver again. Don't forget to tick the "Delete the driver software for this device" Box.  
 Do not uninstall "USB Test and Measurement Devices".

### Linux and Raspberry Pi
 You may need to create an udev rule to grant access permission to the instrument.  
 There are many tutorials about udev rules for usb devices, so please follow these instructions.

#### "/etc/udev/rules.d/99-usbtmc.rules" example
 ~~~sh
 SUBSYSTEM=="usb", ACTION=="add", ATTRS{idVendor}=="xxxx", ATTRS{idProduct}=="yyyy", GROUP="zzzz", MODE="0660"
 ~~~

 If you got an error "NetworkError: Unable to claim interface", you have to unbind your device.

 ~~~console
user@host:~$ ls /sys/bus/usb/drivers/usbtmc/
2-3:1.0  bind  module  new_id  remove_id  uevent  unbind
user@host:~$ sudo sh -c "echo -n 2-3:1.0 > /sys/bus/usb/drivers/usbtmc/unbind"
user@host:~$ ls /sys/bus/usb/drivers/usbtmc/
bind  module  new_id  remove_id  uevent  unbind
 ~~~

 If you are annoyed that you have to unbind your device every time you connect it, blacklisting usbtmc module might be good idea.

#### "/etc/modprobe.d/blacklist.conf" example
 ~~~sh
# for webusbtmc
blacklist usbtmc 
 ~~~

### Mac OS
 Nothing special is necessary for macOS, but I haven't tried yet.

### Android
 You only need an otg cable.

## Run your computer
 I recommend using VsCode + Live Server Extention.  
 Download this repository, open unzipped floder using vscode, and run Live server.
 
