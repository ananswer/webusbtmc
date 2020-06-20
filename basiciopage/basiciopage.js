'use strict';

let deviceName;
let tmc = new Webusbtmc();
let blobURL;
let binaryFile;
let myOutputTo;

const OutputTo = {
  Text: 1,
  Image: 2,
  Download: 3,
};

const SpinnerWidget = '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>';

const $notification = $('#notification-message');
const $outputtextarea = $('#output-textarea');
const $imagefield = $('#image-field');
const $rcvdlength = $('#rcvd-length');
const $devicename = $('#device-name');
const $connectButton = $('#connect-button');
const $inputtext = $('#input-text');

const $writeButton = $('#wr-button');
const $writeWhich = $('#wr-which');
const $readButton = $('#rd-button');
const $readWhich = $('#rd-which');
const $readAsHow = $('#rd-as-how');
const $readLength = $('#rd-length');

const $rstatusButton = $('#rstatus-button');
const $clearDeviceButton = $('#clear-button');

const $writeFileButton = $('#wr-filebutton');
const $writeFileName = $('#wr-filename');

const $clearTextButton = $('#clear-text-button');

function decimalToHex(d, padding = 2) {
  let hex = Number(d).toString(16);
  padding = typeof (padding) === undefined || padding === null ? padding = 2 : padding;

  while (hex.length < padding) {
    hex = '0' + hex;
  }

  return hex;
}

function createDownloadLink(ref, bytes, ext) {
  if (!deviceName) {
    return;
  }

  if (bytes === undefined || bytes === null) {
    return;
  }

  let prevLink = $(ref).attr('href');
  if (prevLink != '#') {
    window.URL.revokeObjectURL(prevLink);
    $(ref).attr('href', '#')
  }

  let file = new Blob([bytes], {type: 'octet/stream'});

  $(ref).attr('href', URL.createObjectURL(file));
  $(ref).attr('target', '_blank');
  $(ref).attr('download', deviceName + '.' + ext);
}

function notify(message) {
  $notification.html('Condition: ' + message);
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
    text = text.replace(tmc.terminatorRead,'');
  }

  if ($outputtextarea.val()) {
    $outputtextarea.val($outputtextarea.val() + '\n' + text);
  }
  else {
    $outputtextarea.val(text);
  }
}

function display(dir, result) {
  if (dir === OutputTo.Image) {
    // https://stackoverflow.com/questions/18299806/how-to-check-file-mime-type-with-javascript-before-upload
    var arr = (new Uint8Array(result)).subarray(0, 4);
    var header = '';
    for(var i = 0; i < arr.length; i++) {
      header += arr[i].toString(16);
    }

    var blobtype = '';
    var ext = '';
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

    if(blobtype == 'unknown') {
      return;
    }

    let blob = new Blob([result], {type: blobtype});
    if (blobURL) {
      window.URL.revokeObjectURL(blobURL);
    }

    blobURL = window.URL.createObjectURL(blob);
    $imagefield.attr('src', blobURL);
    createDownloadLink('#image-link', result, ext);
    print('Binary data received');
  }
  else if (dir === OutputTo.Download) {
    $rcvdlength.html(result.byteLength + ' byte');
    createDownloadLink('#file-link', result, 'bin');
    print('Binary data received');
  }
  else {
    print(result);
  }
}

function connect(device) {
  $devicename.html('Connecting to ' + device.productName + '...');
  tmc.open(device).then(() => {
    deviceName = device.productName.replace(/\s/g,'');
    $devicename.html(device.productName + ' connected.');
    $connectButton.html('Disconnect');
  }).catch((error) => {
    $devicename.html('-');
    notify(error);
  });
};

$(document).ready(function () {
  $('.dropdown-menu .dropdown-item').click(function () {
    let item = $('.dropdown-toggle', $(this).closest('.btn-group.commands'));
    if (item.length != 0) {
      $inputtext.val($(this).attr('value'));
    }
  });

  $('.dropdown-menu .dropdown-item').click(function () {
    let item = $('.dropdown-toggle', $(this).closest('.btn-group.button-names'));
    item.text($(this).attr('value'));
  });

  $connectButton.on('click', function (event) {
    if ($connectButton.html() != 'Connect') {
      notify('');
      tmc.close();
      $devicename.html('-');
      $connectButton.html('Connect');
    } else {
      const filters = [
        {'classCode': 0xFE, 'subclassCode': 0x03, 'protocolCode': 0x01},
      ];
      navigator.usb.requestDevice({'filters': filters}).then((result) => {
        notify('');
        connect(result);
      }).catch((error) => {
        notify(error);
      });
    }
  });
  
  $writeButton.on('click', function (event) {
    if ($connectButton.html() != 'Connect') {
      notify('');
      $writeButton.html(SpinnerWidget+'Write');
      const text = $inputtext.val();
      if ($writeWhich.html() == 'Binary Data' && binaryFile !== undefined && binaryFile !== null) {
        const buffer = new Uint8Array(binaryFile);

        if (text === undefined || text === '') {
          tmc.writeBytes(buffer).then(() => {
            print('Data chunk was sent successfully');
            $writeButton.html('Write');
          }).catch((error) => {
            notify(error);
            $writeButton.html('Write');
          });  
        }
        else {
          tmc.writeBlockData(text, buffer).then(() => {
            print('Binary data was sent successfully');
            $writeButton.html('Write');
          }).catch((error) => {
            notify(error);
            $writeButton.html('Write');
          });  
        }
      }
      else {
        if (text === undefined || text === '') {
          notify('Text is empty');
          $writeButton.html('Write');
        }
        else {
          tmc.write(text).then(() => {
            print(text);
            $writeButton.html('Write');
          }).catch((error) => {
            notify(error);
            $writeButton.html('Write');
          });  
        }
      }
    }
  });
  
  $readButton.on('click', function (event) {
    if ($connectButton.html() != 'Connect') {
      notify('');
      $readButton.html(SpinnerWidget+'Read');
      if ($readAsHow.html() == 'as Image') {
        myOutputTo = OutputTo.Image;
      }
      else if ($readAsHow.html() == 'as Object') {
        myOutputTo = OutputTo.Download;
      }
      else {
        myOutputTo = OutputTo.Text;
      }
      
      if ($readWhich.html() == 'Binary Data') {
        tmc.readBlockData().then((result) => {
          if (!result || result.length == 0) {
            print('Failed to receive the response');
          }
          else {
            display(myOutputTo, result);  
          }
          $readButton.html('Read');
        }).catch((error) => {
          notify(error);
          $readButton.html('Read');
        });
      }
      else {
        let length = 1024;
        if ($readLength.val() != '') {
          length = $readLength.val();
          if (length < 0) {
            length = 1024;
          }  
        }
        tmc.readBytes(length).then((result) => {
          if (!result || result.length == 0) {
            print('Failed to receive the response');
          }
          else {
            display(myOutputTo, result);
          }
          $readButton.html('Read');
        }).catch((error) => {
          notify(error);
          $readButton.html('Read');
        });
      }
    }
  });

  $rstatusButton.on('click', function (event) {
    if ($connectButton.html() != 'Connect') {
      notify('');
      tmc.readStatusByteRegister().then((result) => {
        print('0x' + decimalToHex(result));
      }).catch((error) => {
        notify(error);
      });
    }
  });

  $clearDeviceButton.on('click', function (event) {
    if ($connectButton.html() != 'Connect') {
      notify('');
      tmc.clear().then(() => {
        print('Cleared');
      }).catch((error) => {
        notify(error);
      });
    }
  });

  $writeFileButton.change(function(e){
    let file = e.target.files[0];
    if(file === undefined) {
      return;
    }
    let reader = new FileReader();
    reader.fileName = file.name;
    reader.readAsArrayBuffer(file);
    reader.onload = readerEvent => {
      binaryFile = readerEvent.target.result;
      $writeFileName.html(readerEvent.target.fileName);
    }
  });

  $clearTextButton.on('click', function (event) {
    $outputtextarea.val('');
  });

});

