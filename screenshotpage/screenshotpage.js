'use strict';

import Takescreenshot from './takescreenshot.js';

let isConnected = false;
let deviceName;
let worker = new Takescreenshot();
let blobURL;

const SpinnerWidget = '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>';
const PlugIcon = '<i class="fa fa-plug"></i>';
const CameraIcon = '<i class="fa fa-camera"></i>';
const ImageHtml = '<img class="img-fluid" id="image" alt="Received image">';

const $imageField = $('#image-field');

const $connectButton = $('#connect-button');
const $takeashotButton = $('#takeashot-button');

const $helpButton = $('#help-button');
const $inputCommandText = $('#command-input');
const $yourDeviceTextarea = $('#yourDevice-textarea');

function createDownloadLink(ref, name, bytes, ext) {
  if (!name) {
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
  $(ref).attr('download', name + '.' + ext);
}

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
  if (blobURL) {
    window.URL.revokeObjectURL(blobURL);
  }
  blobURL = window.URL.createObjectURL(blob);

  if($imageField.is(':empty')) {
    $imageField.html(ImageHtml);
  }

  $('#image').attr('src', blobURL);
  createDownloadLink('#download-link', name, result, tmp.extension);
}

$(document).ready(function () {
  $connectButton.on('click', function (event) {
    if (isConnected == true) {
      worker.close();
      $connectButton.html(PlugIcon + ' Connect');
      isConnected = false;
      $takeashotButton.prop('disabled', true);
    } else {
      const filters = [
        {'classCode': 0xFE, 'subclassCode': 0x03, 'protocolCode': 0x01},
      ];
      navigator.usb.requestDevice({'filters': filters}).then((device) => {
        worker.open(device).then(() => {
          deviceName = device.productName.replace(/\s/g,'');
          $connectButton.html(PlugIcon + ' ' + device.productName + 'is connected');

          $inputCommandText.val(worker.command);
          $yourDeviceTextarea.val(
            'VID_' + device.vendorId.toString(16) + ' ' + 'PID_' + device.productId.toString(16) + '\n' +
            '*IDN? => ' + worker.identifier
          );

          isConnected = true;
          $takeashotButton.prop('disabled', false);
        });
      }).catch((error) => {
        alert(error);
        isConnected = false;
        $takeashotButton.prop('disabled', true);
      });
    }
  });
  
  $takeashotButton.prop('disabled', false).on('click', function (event) {
    if (isConnected == true) {
      $helpButton.show();
      $takeashotButton.prop('disabled', true);
      $takeashotButton.html(SpinnerWidget + ' Take a screenshot');

      const isExpanded = $helpButton.attr('aria-expanded');
      if (isExpanded) {
        worker.command = $inputCommandText.val();
      }

      worker.capture().then((reult) => {
        display(reult, deviceName)
        $takeashotButton.html(CameraIcon + ' Take a screenshot');
        $takeashotButton.prop('disabled', false);
      }).catch((error) => {
        alert(error);
        $takeashotButton.html(CameraIcon + ' Take a screenshot');
        $takeashotButton.prop('disabled', false);
      });
    }
  });

  $connectButton.html(PlugIcon + ' Connect');
  $takeashotButton.html(CameraIcon + ' Take a screenshot');
  $takeashotButton.prop('disabled', true);
  $helpButton.hide();

  if(navigator.platform.indexOf('Win') >= 0) {
    $('#windows-advice-text').show();
  }

});

