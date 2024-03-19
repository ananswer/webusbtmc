'use strict';

import Takescreenshot from './takescreenshot.js';

let worker = new Takescreenshot();

const spinnerWidget = '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>';
const plugIcon = '<i class="bi bi-plug"></i>';
const cameraIcon = '<i class="bi bi-camera"></i>';

const connectButton = document.getElementById('connect-button');
const takeashotButton = document.getElementById('takeashot-button');

const fetchDeviceInfoButton = document.getElementById('fetchDeviceInfo-button');

const inputCommandText = document.getElementById('command-input');
const delayTimeText = document.getElementById('delay-input');
const inputBinaryBlockCheck = document.getElementById('binaryBlock-check');
const yourDeviceTextarea = document.getElementById('yourDevice-textarea');



function checkMIMEType(data) {
  // https://stackoverflow.com/questions/18299806/how-to-check-file-mime-type-with-javascript-before-upload
  let arr = (new Uint8Array(data)).subarray(0, 4);
  let header = '';
  for (let i = 0; i < arr.length; i++) {
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

  return { blobtype: blobtype, extension: ext };
}

function display(bytes, name) {
  const tmp = checkMIMEType(bytes);

  if (tmp.blobtype == 'unknown') {
    alert("Failed to display: unknown blob type");
  }

  const blob = new Blob([bytes], { type: tmp.blobtype });

  const reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = () => {
    sessionStorage.setItem('image', reader.result);
    const url = sessionStorage.getItem('image');
    document.getElementById('screenshot-image').src = url;
    document.getElementById('image-area').classList.remove('d-none');
  }

  const donwloadLink = document.getElementById('download-link');
  let blobURL = donwloadLink.href;
  window.URL.revokeObjectURL(blobURL);
  blobURL = window.URL.createObjectURL(blob);
  donwloadLink.href = blobURL;
  donwloadLink.target = '_blank';
  donwloadLink.download = name + '.' + tmp.extension;

}

connectButton.onclick = () => {
  if (worker.opened) {
    worker.close();
    connectButton.innerHTML = plugIcon + ' Connect';
    takeashotButton.disabled = true;
  } else {
    const filters = [
      { 'classCode': 0xFE, 'subclassCode': 0x03, 'protocolCode': 0x01 },
    ];
    navigator.usb.requestDevice({ 'filters': filters })
      .then((device) => {
        connectButton.innerHTML = spinnerWidget + ' Connecting..';
        connectButton.disabled = true;

        worker.open(device)
          .then(() => {
            inputCommandText.value = worker.command;
            delayTimeText.value = worker.delay;
            inputBinaryBlockCheck.checked = worker.isBinaryBlock;
            yourDeviceTextarea.value =
              'VID_' + device.vendorId.toString(16) + ' ' + 'PID_' + device.productId.toString(16) + '\n';
            const deviceName = worker.device.productName.replace(/\s/g, '');
            connectButton.innerHTML = plugIcon + ' ' + deviceName + ' is connected';
            takeashotButton.disabled = false;
          })
          .catch((error) => {
            alert(error);
            connectButton.innerHTML = plugIcon + ' Connect';
            takeashotButton.disabled = true;
          })
          .finally(() => {
            connectButton.disabled = false;
            document.getElementById('help-area').classList.remove('d-none');
          })
      })
      .catch((error) => {
        alert(error);
      });
  }
};


takeashotButton.onclick = () => {
  if (worker.opened == true) {
    takeashotButton.disabled = true;
    takeashotButton.innerHTML = spinnerWidget + ' Take a screenshot';

    const helpButton = document.getElementById('help-button');
    const expanded = helpButton.getAttribute('aria-expanded');
    if (expanded == 'true') {
      worker.command = inputCommandText.value;
      worker.delay = delayTimeText.value;
      worker.isBinaryBlock = inputBinaryBlockCheck.checked;
    }

    worker.capture().then((reult) => {
      takeashotButton.innerHTML = cameraIcon + ' Take a screenshot';
      takeashotButton.disabled = false;
      const deviceName = worker.device.productName.replace(/\s/g, '');
      display(reult, deviceName)
    }).catch((error) => {
      takeashotButton.innerHTML = cameraIcon + ' Take a screenshot';
      takeashotButton.disabled = false;
      alert(error);
    });
  }
};

fetchDeviceInfoButton.onclick = () => {
  if (worker.opened == true) {
    worker.fetchDeviceInfo().then((reult) => {
      yourDeviceTextarea.value =
      'VID_' + worker.device.vendorId.toString(16) + ' ' + 'PID_' + worker.device.productId.toString(16) + '\n' +
      '*IDN? => ' + reult;
    }).catch((error) => {
      alert(error);
    });
  }
};

window.onload = () => {
  if (navigator.platform.indexOf('Win') >= 0) {
    document.getElementById('windows-advice-text').classList.remove('d-none');
  }
};