# webusbtmc
WebUSBTMC is a USBTMC driver utilizing the WebUSB API.

## What is USBTMC?
USBTMC is a device class specification for remotely controlling test and measurement instruments.  
It is also used in VISA (Virtual Instrument Software Architecture) to communicate with instruments over USB.

## Code example and practical examples
See [v2/README.md](v2/README.md).  
The previous version is kept in [v1](v1/README.md).

## Setup
### Windows
You need to install the WinUSB driver for your instrument using Zadig.  
If you have already installed NI-VISA, Keysight IO Libraries Suite, or similar tools, replace the USBTMC driver with the WinUSB driver using Zadig.  
You can [uninstall the WinUSB driver](https://github.com/pbatard/libwdi/wiki/FAQ#Help_Zadig_replaced_the_driver_for_the_wrong_device_How_do_I_restore_it) if you want to restore the original USBTMC driver.  
Don't forget to tick the "Delete the driver software for this device" checkbox.  
**Do not uninstall "USB Test and Measurement Devices".**

### Linux and Raspberry Pi
You may need to create a udev rule to grant access permission to the instrument.  
There are many tutorials about udev rules for USB devices; please follow those instructions.

#### "/etc/udev/rules.d/99-usbtmc.rules" example
~~~sh
SUBSYSTEM=="usb", ACTION=="add", ATTRS{idVendor}=="xxxx", ATTRS{idProduct}=="yyyy", GROUP="zzzz", MODE="0660"
~~~

If you encounter the error "NetworkError: Unable to claim interface", you must unbind your device:

~~~console
user@host:~$ ls /sys/bus/usb/drivers/usbtmc/
2-3:1.0  bind  module  new_id  remove_id  uevent  unbind
user@host:~$ sudo sh -c "echo -n 2-3:1.0 > /sys/bus/usb/drivers/usbtmc/unbind"
user@host:~$ ls /sys/bus/usb/drivers/usbtmc/
bind  module  new_id  remove_id  uevent  unbind
~~~

To avoid unbinding your device every time you connect it, consider blacklisting the USBTMC module.

#### "/etc/modprobe.d/blacklist.conf" example
~~~sh
# for webusbtmc
blacklist usbtmc
~~~

### macOS
No special setup is necessary.

### Android
You only need an OTG cable.


## Run on Your Computer
I recommend using VS Code with the Live Server extension.  
Download this repository, open the unzipped folder in VS Code, and run Live Server.
