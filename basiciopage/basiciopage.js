'use strict';

import Webusbtmc from '../webusbtmc/webusbtmc.js';

let worker = new Webusbtmc();

let deviceName;
let binaryFile;
let writeTransferType;
let readTransferType;
let readOutputTo;

const TransferType = {
  Normal: 1,
  Binary: 2,
};

const OutputTo = {
  Text: 1,
  Image: 2,
  Object: 3,
};


const spinnerWidget = '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>';
const plugIcon = '<i class="bi bi-plug"></i>';

const notification = document.getElementById('notification-message');
const outputtextarea = document.getElementById('output-textarea');

const connectButton = document.getElementById('connect-button');

const inputtext = document.getElementById('input-text');
const writeButton = document.getElementById('wr-button');
const writeWhich = document.getElementById('wr-which');
const writeTransferDataButton = document.getElementById('wr-transfer-data');
const writeTransferBinaryButton = document.getElementById('wr-transfer-bin');


const readButton = document.getElementById('rd-button');
const readWhich = document.getElementById('rd-which');
const readAsHow = document.getElementById('rd-as-how');
const readLength = document.getElementById('rd-length');
const readTransferDataButton = document.getElementById('rd-transfer-data');
const readTransferBinaryButton = document.getElementById('rd-transfer-bin');

const readAsTextButton = document.getElementById('rd-as-text');
const readAsImageButton = document.getElementById('rd-as-image');
const readAsObjectButton = document.getElementById('rd-as-object');


const rstatusButton = document.getElementById('rstatus-button');
const clearDeviceButton = document.getElementById('clear-button');
const writeFileButton = document.getElementById('wr-filebutton');
const writeFileName = document.getElementById('wr-filename');
const clearTextButton = document.getElementById('clear-text-button');

function decimalToHex(d, padding = 2) {
  let hex = Number(d).toString(16);
  padding = typeof (padding) === undefined || padding === null ? padding = 2 : padding;

  while (hex.length < padding) {
    hex = '0' + hex;
  }

  return hex;
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

function notify(message) {
  notification.innerHTML = 'Condition: ' + message;
}

function print(result) {
  if (!result) {
    return;
  }

  let text;
  if (typeof result === 'string' || result instanceof String) {
    text = result;
  }
  else {
    const textDecoder = new TextDecoder();
    text = textDecoder.decode(result);
    text = text.replace(worker.terminatorRead, '');
  }

  if (outputtextarea.value) {
    outputtextarea.value = outputtextarea.value + '\n' + text;
    outputtextarea.scrollTop;
  }
  else {
    outputtextarea.value = text;
  }
}

function display(dir, result, name) {
  if (dir === OutputTo.Image) {

    const tmp = checkMIMEType(result);

    if (tmp.blobtype == 'unknown') {
      print('Unknown MIME type');
      return;
    }

    const blob = new Blob([result], { type: tmp.blobtype });
    const link = document.getElementById('image-link');
    let blobURL = link.href;
    window.URL.revokeObjectURL(blobURL);
    blobURL = window.URL.createObjectURL(blob);
    link.href = blobURL;
    link.target = '_blank';
    link.download = name + '.' + tmp.extension;

    const image = document.getElementById('image-field');
    image.src = blobURL;

    document.getElementById('image-area').classList.remove('d-none');

    print('Image data received');
  }
  else if (dir === OutputTo.Object) {
    let blob = new Blob([result], { type: 'octet/stream' });
    const link = document.getElementById('file-link');
    let blobURL = link.href;
    window.URL.revokeObjectURL(blobURL);
    blobURL = window.URL.createObjectURL(blob);
    link.href = blobURL;
    link.target = '_blank';
    link.download = name + '.bin';

    document.getElementById('rcvd-length').innerHTML = result.byteLength + ' byte';

    document.getElementById('object-area').classList.remove('d-none');

    print('Binary data received');
  }
  else {
    print(result);
  }
}

connectButton.onclick = () => {
  if (worker.opened) {
    worker.close();
    connectButton.innerHTML = plugIcon + ' Connect';
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
            deviceName = worker.device.productName.replace(/\s/g, '');
            connectButton.innerHTML = plugIcon + ' ' + deviceName + ' is connected';
          })
          .catch((error) => {
            alert(error);
            connectButton.innerHTML = plugIcon + ' Connect';
          })
          .finally(() => {
            connectButton.disabled = false;
          })
      })
      .catch((error) => {
        alert(error);
      });
  }
};

writeTransferDataButton.onclick = () => {
  writeTransferType = TransferType.Normal;
  writeWhich.innerHTML = 'Data';
}

writeTransferBinaryButton.onclick = () => {
  writeTransferType = TransferType.Binary;
  writeWhich.innerHTML = 'Binary Data';
}

writeButton.onclick = () => {
  if (!worker.opened) {
    return;
  }

  notify('');
  writeButton.innerHTML = spinnerWidget + ' Write';
  const text = inputtext.value;
  if (writeTransferType === TransferType.Binary && binaryFile !== undefined && binaryFile !== null) {
    const buffer = new Uint8Array(binaryFile);

    if (text === undefined || text === '') {
      worker.writeBytes(buffer).then(() => {
        print('Data chunk was sent successfully');
        writeButton.innerHTML = 'Write';
      }).catch((error) => {
        notify(error);
        writeButton.innerHTML = 'Write';
      });
    }
    else {
      worker.writeBlockData(text, buffer).then(() => {
        print('Binary data was sent successfully');
        writeButton.innerHTML = 'Write';
      }).catch((error) => {
        notify(error);
        writeButton.innerHTML = 'Write';
      });
    }
  }
  else {
    if (text === undefined || text === '') {
      notify('Text is empty');
      writeButton.innerHTML = 'Write';
    }
    else {
      worker.write(text).then(() => {
        print(text);
        writeButton.innerHTML = 'Write';
      }).catch((error) => {
        notify(error);
        writeButton.innerHTML = 'Write';
      });
    }
  }
}

readTransferDataButton.onclick = () => {
  readTransferType = TransferType.Normal;
  readWhich.innerHTML = 'Data';
}

readTransferBinaryButton.onclick = () => {
  readTransferType = TransferType.Binary;
  readWhich.innerHTML = 'Binary Data';
}

readAsTextButton.onclick = () => {
  readOutputTo = OutputTo.Text;
  readAsHow.innerHTML = 'as Text';
}

readAsImageButton.onclick = () => {
  readOutputTo = OutputTo.Image;
  readAsHow.innerHTML = 'as Image';
}

readAsObjectButton.onclick = () => {
  readOutputTo = OutputTo.Object;
  readAsHow.innerHTML = 'as Object';
}

readButton.onclick = () => {
  if (!worker.opened) {
    return;
  }

  notify('');
  readButton.innerHTML = spinnerWidget + ' Read';

  if (readTransferType === TransferType.Binary) {
    worker.readBlockData().then((result) => {
      if (!result || result.length == 0) {
        print('Failed to receive the response');
      }
      else {
        display(readOutputTo, result, deviceName);
      }
      readButton.innerHTML = 'Read';
    }).catch((error) => {
      notify(error);
      readButton.innerHTML = 'Read';
    });
  }
  else {
    let length = 65535;
    if (readLength.value != '') {
      length = readLength.value;
      if (length < 0) {
        length = 65535;
      }
    }
    worker.readBytes(length).then((result) => {
      if (!result || result.length == 0) {
        print('Failed to receive the response');
      }
      else {
        display(readOutputTo, result, deviceName);
      }
      readButton.innerHTML = 'Read';
    }).catch((error) => {
      notify(error);
      readButton.innerHTML = 'Read';
    });
  }
}


rstatusButton.onclick = () => {
  if (!worker.opened) {
    return;
  }

  notify('');
  worker.readStatusByteRegister().then((result) => {
    print('0x' + decimalToHex(result));
  }).catch((error) => {
    notify(error);
  });
}

clearDeviceButton.onclick = () => {
  if (!worker.opened) {
    return;
  }

  notify('');
  worker.clear().then(() => {
    print('Cleared');
  }).catch((error) => {
    notify(error);
  });
}

writeFileButton.onclick = (e) => {
  let file = e.target.files[0];
  if (file === undefined) {
    return;
  }
  let reader = new FileReader();
  reader.fileName = file.name;
  reader.readAsArrayBuffer(file);
  reader.onload = readerEvent => {
    binaryFile = readerEvent.target.result;
    writeFileName.innerHTML = readerEvent.target.fileName;
  }
}

clearTextButton.onclick = () => {
  outputtextarea.value = '';
}

window.onload = () => {
  let targetElements = document.getElementById('command-group').getElementsByClassName('dropdown-item');

  for (let element of targetElements) {
    element.addEventListener('click', () => {
      inputtext.value = element.innerHTML;
    });
  }

};
