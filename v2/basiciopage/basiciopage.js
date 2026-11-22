'use strict';

import Webusbtmc from '../webusbtmc/webusbtmc.js';
import { setupConnectButton, runWithSpinner, confirmLeaveWhileConnected, setupHowTo, showError, showMessage, appendLog, logText } from '../common/ui.js';

const worker = new Webusbtmc();

let deviceName;
let binaryFile;

const OutputTo = {
  Text: 'text',
  Image: 'image',
  Object: 'object',
};

const $ = (id) => document.getElementById(id);

const log = $('output-log');
const inputtext = $('input-text');
const writeButton = $('wr-button');
const readButton = $('rd-button');
const rstatusButton = $('rstatus-button');
const clearDeviceButton = $('clear-button');
const writeFileButton = $('wr-filebutton');
const clearTextButton = $('clear-text-button');
const copyLogButton = $('copy-log-button');

// Names of the bits of the IEEE 488.2 / SCPI status byte. The other bits depend on the instrument.
const STATUS_BITS = { 7: 'OSB', 6: 'MSS', 5: 'ESB', 4: 'MAV', 3: 'QSB', 2: 'EAV' };

function describeStatusByte(value) {
  const names = [];
  for (let bit = 7; bit >= 0; bit--) {
    if (value & (1 << bit)) {
      names.push(STATUS_BITS[bit] || 'bit ' + bit);
    }
  }
  return names.length > 0 ? names.join(', ') : 'no bits set';
}

// Commands that were sent, for the up and down keys of the command field.
const history = [];
let historyIndex = 0;

function decimalToHex(d, padding = 2) {
  return Number(d).toString(16).padStart(padding, '0');
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

function print(result, kind = 'info') {
  if (!result) {
    return;
  }

  let text;
  if (typeof result === 'string' || result instanceof String) {
    text = result;
  }
  else {
    text = new TextDecoder().decode(result);
    const terminator = worker.terminatorRead;
    if (terminator && text.endsWith(terminator)) {
      text = text.slice(0, -terminator.length);
    }
  }

  appendLog(log, kind, text);
}

function showTab(id) {
  bootstrap.Tab.getOrCreateInstance($(id)).show();
}

function display(dir, result, name) {
  if (dir === OutputTo.Image) {

    const tmp = checkMIMEType(result);

    if (tmp.blobtype == 'unknown') {
      print('Unknown MIME type');
      return;
    }

    const blob = new Blob([result], { type: tmp.blobtype });
    const link = $('image-link');
    let blobURL = link.href;
    window.URL.revokeObjectURL(blobURL);
    blobURL = window.URL.createObjectURL(blob);
    link.href = blobURL;
    link.target = '_blank';
    link.download = name + '.' + tmp.extension;

    $('image-field').src = blobURL;

    $('image-empty').classList.add('d-none');
    $('image-area').classList.remove('d-none');

    print('Image data received');
    showTab('image-tab');
  }
  else if (dir === OutputTo.Object) {
    let blob = new Blob([result], { type: 'octet/stream' });
    const link = $('file-link');
    let blobURL = link.href;
    window.URL.revokeObjectURL(blobURL);
    blobURL = window.URL.createObjectURL(blob);
    link.href = blobURL;
    link.target = '_blank';
    link.download = name + '.bin';

    $('rcvd-length').textContent = result.byteLength + ' byte';

    $('object-empty').classList.add('d-none');
    $('object-area').classList.remove('d-none');

    print('Binary data received');
    showTab('object-tab');
  }
  else {
    print(result, 'rx');
  }
}

const run = (button, operation) => runWithSpinner(button, operation, () => worker.opened);

setupConnectButton({
  isOpen: () => worker.opened,
  open: async (device) => {
    await worker.open(device);
    deviceName = worker.device.productName.replace(/\s/g, '');
  },
  close: () => worker.close(),
});

writeButton.onclick = () => run(writeButton, async () => {
  const text = inputtext.value;
  if ($('wr-type').value === 'binary' && binaryFile !== undefined && binaryFile !== null) {
    const buffer = new Uint8Array(binaryFile);

    if (text === '') {
      await worker.writeBytes(buffer);
      print('Data chunk was sent successfully');
    }
    else {
      await worker.writeBlockData(text, buffer);
      print('Binary data was sent successfully');
    }
  }
  else {
    if (text === '') {
      showError({ name: 'Empty', message: 'Enter a command first.' });
      return;
    }
    await worker.write(text);
    print(text, 'tx');
    if (history[history.length - 1] !== text) {
      history.push(text);
    }
    historyIndex = history.length;
  }
});

readButton.onclick = () => run(readButton, async () => {
  const timeout = parseInt($('rd-timeout').value);
  let result;
  if ($('rd-type').value === 'binary') {
    result = await worker.readBlockData(timeout);
  }
  else {
    let length = parseInt($('rd-length').value);
    if (!(length > 0)) {
      length = 65535;
    }
    result = await worker.readBytes(length, timeout);
  }

  if (result.length == 0) {
    print('Received an empty response');
  }
  else {
    display($('rd-as').value, result, deviceName);
  }
});

rstatusButton.onclick = () => run(rstatusButton, async () => {
  const result = await worker.readStatusByteRegister();
  print('Status byte 0x' + decimalToHex(result).toUpperCase() + ' (' + describeStatusByte(result) + ')', 'rx');
});

clearDeviceButton.onclick = () => run(clearDeviceButton, async () => {
  await worker.clear();
  print('Device cleared');
});

writeFileButton.onchange = (e) => {
  const file = e.target.files[0];
  if (file === undefined) {
    return;
  }
  const reader = new FileReader();
  reader.readAsArrayBuffer(file);
  reader.onload = (readerEvent) => {
    binaryFile = readerEvent.target.result;
  };
};

clearTextButton.onclick = () => {
  log.innerHTML = '<div class="empty">Nothing yet. Connect, then write a command.</div>';
};

copyLogButton.onclick = async () => {
  try {
    await navigator.clipboard.writeText(logText(log));
    copyLogButton.textContent = 'Copied';
    setTimeout(() => { copyLogButton.textContent = 'Copy'; }, 1500);
  } catch (error) {
    showMessage('warn', 'Could not copy to the clipboard.');
  }
};

// Up and down keys in the command field recall the commands that were sent.
inputtext.addEventListener('keydown', (event) => {
  if ((event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || history.length === 0) {
    return;
  }
  event.preventDefault();
  historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
  inputtext.value = history[historyIndex] || '';
});

// The examples menu fills the command field.
for (const item of $('command-group').getElementsByClassName('dropdown-item')) {
  item.addEventListener('click', () => {
    inputtext.value = item.textContent;
    inputtext.focus();
  });
}

confirmLeaveWhileConnected(() => worker.opened);
setupHowTo();
