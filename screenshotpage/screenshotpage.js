'use strict';

import Takescreenshot from './takescreenshot.js';

let isConnected = false;
let deviceName;
let worker = new Takescreenshot();

const spinnerWidget = '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>';
const plugIcon = '<i class="bi bi-plug"></i>';
const cameraIcon = '<i class="bi bi-camera"></i>';

const connectButton = document.getElementById('connect-button');
const takeashotButton = document.getElementById('takeashot-button');

const inputCommandText = document.getElementById('command-input');
const yourDeviceTextarea = document.getElementById('yourDevice-textarea');



function checkMIMEType(data) {
  // https://stackoverflow.com/questions/18299806/how-to-check-file-mime-type-with-javascript-before-upload
  let arr = (new Uint8Array(data)).subarray(0, 4);
  let header = '';
  for(let i = 0; i < arr.length; i++) {
    header += arr[i].toString(16);
  }

  let blobtype = '';
  let ext = '';
  switch (header) {
    case '89504e47':
      blobtype = 'image/png';
      ext = 'png';
      break;
    case '47494638':
      blobtype = 'image/gif';
      ext = 'gif';
      break;
    case 'ffd8ffe0':
    case 'ffd8ffe1':
    case 'ffd8ffe2':
    case 'ffd8ffe3':
    case 'ffd8ffe8':
      blobtype = 'image/jpeg';
      ext = 'jpg';
      break;
    default:
      blobtype = 'unknown'; // Or you can use the blob.type as fallback
      break;
  }

  return { blobtype: blobtype, extension : ext };
}

function display(result, name) {
  const tmp = checkMIMEType(result);

  if(tmp.blobtype == 'unknown') {
    return;
  }

  const blob = new Blob([result], {type: tmp.blobtype});
  const screenshotImage = document.getElementById('screenshot-image');
  let blobURL = screenshotImage.src;
  window.URL.revokeObjectURL(blobURL);
  blobURL = window.URL.createObjectURL(blob);
  screenshotImage.src = blobURL;

  const donwloadLink = document.getElementById('download-link');
  donwloadLink.href = blobURL;
  donwloadLink.target = '_blank';
  donwloadLink.download = name + '.' + tmp.extension;

  document.getElementById('image-area').classList.remove('d-none');
}

connectButton.onclick = () => {
  if (isConnected == true) {
    worker.close();
    connectButton.innerHTML = plugIcon + ' Connect';
    isConnected = false;
    takeashotButton.disabled = true;
  } else {
    const filters = [
      {'classCode': 0xFE, 'subclassCode': 0x03, 'protocolCode': 0x01},
    ];
    navigator.usb.requestDevice({'filters': filters}).then((device) => {
      worker.open(device).then(() => {
        deviceName = device.productName.replace(/\s/g,'');
        connectButton.innerHTML = plugIcon + ' ' + device.productName + ' is connected';

        inputCommandText.value = worker.command;
        yourDeviceTextarea.value = 
          'VID_' + device.vendorId.toString(16) + ' ' + 'PID_' + device.productId.toString(16) + '\n' +
          '*IDN? => ' + worker.identifier;

        isConnected = true;
        takeashotButton.disabled = false;
      });
    }).catch((error) => {
      alert(error);
      isConnected = false;
      takeashotButton.disabled = true;
    });
  }
};


takeashotButton.onclick = () => {
  if (isConnected == true) {
    document.getElementById('help-area').classList.remove('d-none');
    takeashotButton.disabled = true;
    takeashotButton.innerHTML = spinnerWidget + ' Take a screenshot';

    const helpButton = document.getElementById('help-button');
    const expanded = helpButton.getAttribute('aria-expanded');
    if (expanded == 'true') {
      worker.command = inputCommandText.value;
    }

    worker.capture().then((reult) => {
      takeashotButton.innerHTML = cameraIcon + ' Take a screenshot';
      takeashotButton.disabled = false;
      display(reult, deviceName)
    }).catch((error) => {
      takeashotButton.innerHTML = cameraIcon + ' Take a screenshot';
      takeashotButton.disabled = false;
      alert(error);
    });
  }
};


window.onload = () => {
  if(navigator.platform.indexOf('Win') >= 0) {
    document.getElementById('windows-advice-text').classList.remove('d-none');
  }
};