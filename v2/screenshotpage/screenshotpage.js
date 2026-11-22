'use strict';

import Takescreenshot from './takescreenshot.js';
import { setupConnectButton, runWithSpinner, confirmLeaveWhileConnected, setupHowTo, showMessage } from '../common/ui.js';

const worker = new Takescreenshot();

const $ = (id) => document.getElementById(id);

const takeashotButton = $('takeashot-button');
const fetchDeviceInfoButton = $('fetchDeviceInfo-button');
const copyImageButton = $('copy-image-button');

const inputCommandText = $('command-input');
const delayTimeText = $('delay-input');
const inputBinaryBlockCheck = $('binaryBlock-check');
const yourDeviceTextarea = $('yourDevice-textarea');

function hex(value) {
  return Number(value).toString(16);
}

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

// 20261022-203423
function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

// The instrument is not known: ask for the command instead of failing later.
function askForCommand() {
  $('advanced').open = true;
  inputCommandText.focus();
  showMessage('warn', 'Enter the screenshot command of your instrument.',
    'This instrument is not known yet. The command is in its programming manual. Enter it under Advanced settings.');
}

function display(bytes, name) {
  if (!bytes || bytes.length === 0) {
    showMessage('warn', 'No image was received.',
      'Open the advanced settings and check the screenshot command and the wait time.');
    return;
  }

  const tmp = checkMIMEType(bytes);

  if (tmp.blobtype == 'unknown') {
    showMessage('warn', 'The instrument did not return an image.',
      'Open the advanced settings and check the screenshot command and the binary block setting.');
    return;
  }

  const blob = new Blob([bytes], { type: tmp.blobtype });

  const image = $('screenshot-image');
  window.URL.revokeObjectURL(image.src);
  image.src = window.URL.createObjectURL(blob);
  image.classList.remove('d-none');
  $('screen-empty').classList.add('d-none');

  const downloadLink = $('download-link');
  window.URL.revokeObjectURL(downloadLink.href);
  downloadLink.href = window.URL.createObjectURL(blob);
  downloadLink.target = '_blank';
  downloadLink.download = name + '_' + timestamp() + '.' + tmp.extension;
  downloadLink.classList.remove('disabled');
  downloadLink.removeAttribute('aria-disabled');
  copyImageButton.disabled = false;
}

setupConnectButton({
  isOpen: () => worker.opened,
  open: async (device) => {
    await worker.open(device);
    inputCommandText.value = worker.command;
    delayTimeText.value = worker.delay;
    inputBinaryBlockCheck.checked = worker.isBinaryBlock;
    yourDeviceTextarea.value =
      'VID_' + hex(device.vendorId) + ' ' + 'PID_' + hex(device.productId) + '\n';
    if (!worker.command) {
      askForCommand();
    }
  },
  close: () => worker.close(),
});

takeashotButton.onclick = () => runWithSpinner(takeashotButton, async () => {
  worker.command = inputCommandText.value;
  worker.delay = delayTimeText.value;
  worker.isBinaryBlock = inputBinaryBlockCheck.checked;
  if (!worker.command) {
    askForCommand();
    return;
  }

  const result = await worker.capture();
  display(result, worker.device.productName.replace(/\s/g, ''));
}, () => worker.opened);

copyImageButton.onclick = async () => {
  const html = copyImageButton.innerHTML;
  try {
    // Only PNG can be put on the clipboard, so the image is drawn on a canvas first.
    const image = $('screenshot-image');
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    copyImageButton.innerHTML = '<i class="bi bi-check2 me-1"></i>Copied';
    setTimeout(() => { copyImageButton.innerHTML = html; }, 1500);
  } catch (error) {
    showMessage('warn', 'Could not copy the image.', 'Use Save image instead.');
  }
};

fetchDeviceInfoButton.onclick = () => runWithSpinner(fetchDeviceInfoButton, async () => {
  const result = await worker.fetchDeviceInfo();
  yourDeviceTextarea.value =
    'VID_' + hex(worker.device.vendorId) + ' ' + 'PID_' + hex(worker.device.productId) + '\n' +
    '*IDN? => ' + result;
}, () => worker.opened);

confirmLeaveWhileConnected(() => worker.opened);
setupHowTo();
