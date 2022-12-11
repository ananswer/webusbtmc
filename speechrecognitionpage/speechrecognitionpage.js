'use strict';

import webusbtmc from '../webusbtmc/webusbtmc.js';

var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition
var SpeechGrammarList = SpeechGrammarList || webkitSpeechGrammarList
var SpeechRecognitionEvent = SpeechRecognitionEvent || webkitSpeechRecognitionEvent

let recognition = new SpeechRecognition();

let isRecognizing = false;
let isStopRecognizing = false;
let worker = new webusbtmc();
let lastText;
let count = 0;

const spinnerWidget = '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>';
const plugIcon = '<i class="bi bi-plug"></i>';

const connectButton = document.getElementById('connect-button');
const recognitionButton = document.getElementById('recognition-button');
const languageSelector = document.getElementById('language-selector');

const whatyousaid = document.getElementById('whatyousaid');

const inputKeyword = document.getElementById('input-keyword');
const inputKeyword2 = document.getElementById('input-keyword2');
const inputKeyword3 = document.getElementById('input-keyword3');

const inputCommand = document.getElementById('input-command');
const inputCommand2 = document.getElementById('input-command2');
const inputCommand3 = document.getElementById('input-command3');


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
            const deviceName = worker.device.productName.replace(/\s/g, '');
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

recognitionButton.onclick = () => {
  if (!isRecognizing) {
    isStopRecognizing = false;
    voiceRecognition();
    recognitionButton.innerHTML = 'Stop speech recognition';
  }
  else {
    isStopRecognizing = true;
    recognitionButton.innerHTML = 'Start speech recognition';
    recognition.stop();
  }

}

function voiceRecognition() {
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = languageSelector.value;

  recognition.onresult = (event) => {
    if (typeof (event.results) == 'undefined') {
      recognition.onend = null;
      recognition.stop();
      return;
    }
    for (var i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        let final_transcript = event.results[i][0].transcript;
        whatyousaid.value = final_transcript;
        let text = validateText(final_transcript);
        if (text != lastText) {
          validateCommand(text);
        }
        lastText = '';
      } else {
        let interim_transcript = event.results[i][0].transcript;
        whatyousaid.value = interim_transcript;
        let text = validateText(interim_transcript);
        if (text != lastText) {
          validateCommand(text);
        }
        lastText = text;
      }
    }
  }

  recognition.onend = () => {
    if (!isStopRecognizing) {
      voiceRecognition();
    }
    else {
      isRecognizing = false;
    }
  }

  recognition.onerror = (event) => {
    whatyousaid.value = 'Error occurred in recognition: ' + event.error;
  }

  recognition.start();
  isRecognizing = true;

}

function validateText(text) {
  if (text === undefined || text === '') {
    return;
  }

  let validatedText;
  let keyword = inputKeyword.value;
  let keyword2 = inputKeyword2.value;
  let keyword3 = inputKeyword3.value;

  let index = -1;
  if (keyword !== undefined && keyword !== '') {
    index = text.lastIndexOf(keyword);
  }

  let index2 = -1;
  if (keyword2 !== undefined && keyword2 !== '') {
    index2 = text.lastIndexOf(keyword2);
  }

  let index3 = -1;
  if (keyword2 !== undefined && keyword3 !== '') {
    index3 = text.lastIndexOf(keyword3);
  }

  if (index >= 0 && index > index2 && index > index3) {
    validatedText = keyword;
  }
  if (index2 >= 0 && index2 > index && index2 > index3) {
    validatedText = keyword2;
  }
  if (index3 >= 0 && index3 > index && index3 > index2) {
    validatedText = keyword3;
  }

  return validatedText;
}

function validateCommand(text) {
  let validatedText = validateText(text);

  if (validatedText === undefined || validatedText === '') {
    return;
  }

  let command = '';
  let keyword = inputKeyword.value;
  let keyword2 = inputKeyword2.value;
  let keyword3 = inputKeyword3.value;

  if (keyword !== undefined && keyword !== '') {
    if (validatedText.includes(keyword)) {
      command = inputCommand.value;
    }
  }
  if (keyword2 !== undefined && keyword2 !== '') {
    if (validatedText.includes(keyword2)) {
      command = inputCommand2.value;
    }
  }
  if (keyword3 !== undefined && keyword3 !== '') {
    if (validatedText.includes(keyword3)) {
      command = inputCommand3.value;
    }
  }

  if (command === undefined || command === '') {
    return;
  }

  console.log(count + ' ' + validatedText);
  count++;

  if (worker.opened) {
    worker.write(command);
  }

}

window.onload = () => {
  if (navigator.platform.indexOf('Win') >= 0) {
    document.getElementById('windows-advice-text').classList.remove('d-none');
  }
};