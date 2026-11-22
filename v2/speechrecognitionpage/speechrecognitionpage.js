'use strict';

import webusbtmc from '../webusbtmc/webusbtmc.js';
import { setupConnectButton, confirmLeaveWhileConnected, setupHowTo, showError, showMessage, clearMessages, appendLog } from '../common/ui.js';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

const worker = new webusbtmc();
let writeQueue = Promise.resolve();

const $ = (id) => document.getElementById(id);

const recognitionButton = $('recognition-button');
const languageSelector = $('language-selector');
const whatyousaid = $('whatyousaid');
const testMode = $('test-mode');
const earlyMode = $('early-mode');
const listenDot = $('listen-dot');
const listenText = $('listen-text');
const log = $('speech-log');

// The three pairs of a keyword and the command that is sent when it is heard.
const pairs = [
  { keyword: $('input-keyword'), command: $('input-command') },
  { keyword: $('input-keyword2'), command: $('input-command2') },
  { keyword: $('input-keyword3'), command: $('input-command3') },
];

// ---------------------------------------------------------------- settings
// The language and the pairs are remembered in the browser.

const STORAGE_KEY = 'tmc-speech';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      language: languageSelector.value,
      pairs: pairs.map((pair) => [pair.keyword.value, pair.command.value]),
    }));
  } catch (error) {
    // The settings are just not remembered.
  }
}

// The remembered language, or else the language of the browser.
function chooseLanguage(saved) {
  const options = [...languageSelector.options].map((option) => option.value);
  if (options.includes(saved)) {
    return saved;
  }

  const wanted = (navigator.language || 'en-US').toLowerCase();
  const chinese = { 'zh-cn': 'cmn-Hans-CN', 'zh-tw': 'cmn-Hant-TW', 'zh-hk': 'yue-Hant-HK' };
  return chinese[wanted]
    || options.find((value) => value.toLowerCase() === wanted)
    || options.find((value) => value.toLowerCase().startsWith(wanted.split('-')[0] + '-'))
    || 'en-US';
}

const saved = loadSettings();
languageSelector.value = chooseLanguage(saved.language);
(saved.pairs || []).forEach(([keyword, command], i) => {
  if (pairs[i]) {
    pairs[i].keyword.value = keyword;
    pairs[i].command.value = command;
  }
});
languageSelector.addEventListener('change', saveSettings);
for (const pair of pairs) {
  pair.keyword.addEventListener('input', saveSettings);
  pair.command.addEventListener('input', saveSettings);
}

// ---------------------------------------------------------------- keywords

// Languages that are written without spaces: a keyword may be inside a longer word.
// In the other languages a keyword has to be heard as a whole word ("on" is not in "one").
const WITHOUT_SPACES = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}]/u;

function lastIndexOfKeyword(text, keyword) {
  text = text.toLowerCase();
  keyword = keyword.trim().toLowerCase();
  if (keyword === '') {
    return -1;
  }
  if (WITHOUT_SPACES.test(keyword)) {
    return text.lastIndexOf(keyword);
  }

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const whole = new RegExp('(?<![\\p{L}\\p{N}])' + escaped + '(?![\\p{L}\\p{N}])', 'gu');
  const found = [...text.matchAll(whole)];
  return found.length > 0 ? found[found.length - 1].index : -1;
}

// The pair whose keyword was heard last in the text.
function findMatch(text) {
  let best = null;
  for (const pair of pairs) {
    const index = lastIndexOfKeyword(text, pair.keyword.value);
    if (index >= 0 && pair.command.value !== '' && (best === null || index > best.index)) {
      best = { index: index, keyword: pair.keyword.value.trim(), command: pair.command.value };
    }
  }
  return best;
}

// A keyword heard: send its command (or only show it in the test mode).
function act(match, heard) {
  const said = '   (heard “' + heard.trim() + '”)';

  if (testMode.checked) {
    appendLog(log, 'info', 'Test mode, not sent: ' + match.command + said);
    return;
  }
  if (!worker.opened) {
    appendLog(log, 'info', 'Heard “' + match.keyword + '”, but no instrument is connected.');
    return;
  }

  // Results can arrive faster than a write completes; send them one at a time.
  writeQueue = writeQueue
    .then(() => worker.write(match.command))
    .then(() => appendLog(log, 'tx', match.command + said))
    .catch((error) => showError(error));
}

// ---------------------------------------------------------------- recognition

let wanted = false;   // the user has started the recognition and has not stopped it
let handled = {};     // result number -> keyword that was already acted on

function showListening(on) {
  listenDot.className = 'dot' + (on ? ' ok' : '');
  listenText.textContent = on ? 'Listening' : 'Not listening';
}

function startRecognition() {
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = languageSelector.value;
  handled = {};
  recognition.start();
}

function stopRecognition() {
  wanted = false;
  recognitionButton.textContent = 'Start speech recognition';
  showListening(false);
  recognition.stop();
}

const ERRORS = {
  'not-allowed': ['Microphone access was denied.', 'Allow the microphone for this site (the icon in the address bar), then press Start again.'],
  'service-not-allowed': ['Microphone access was denied.', 'Allow the microphone for this site (the icon in the address bar), then press Start again.'],
  'audio-capture': ['No microphone was found.', 'Connect a microphone, then press Start again.'],
  'network': ['The speech service could not be reached.', 'Speech recognition needs an internet connection.'],
  'language-not-supported': ['This language is not supported.', 'Choose another language.'],
};

if (recognition) {
  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      whatyousaid.value = text;

      // A phrase that is still being heard can change; by default only the finished phrase counts.
      if (!result.isFinal && !earlyMode.checked) {
        continue;
      }

      const match = findMatch(text);
      if (match && handled[i] !== match.keyword) {
        handled[i] = match.keyword;
        act(match, text);
      }
    }
  };

  recognition.onaudiostart = () => showListening(true);

  recognition.onend = () => {
    showListening(false);
    if (wanted) {
      startRecognition();   // the browser ends the recognition after a silence; listen again
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') {
      return;   // silence, or stopped by the user: nothing to report
    }
    const [title, body] = ERRORS[event.error] || ['Speech recognition stopped.', 'Error: ' + event.error];
    showMessage('err', title, body);
    appendLog(log, 'info', 'Stopped: ' + event.error);
    stopRecognition();
  };

  recognitionButton.onclick = () => {
    if (wanted) {
      stopRecognition();
      appendLog(log, 'info', 'Stopped.');
    } else {
      clearMessages();
      wanted = true;
      recognitionButton.textContent = 'Stop speech recognition';
      appendLog(log, 'info', 'Started (' + languageSelector.value + ')' + (testMode.checked ? ', test mode' : ''));
      startRecognition();
    }
  };
} else {
  recognitionButton.disabled = true;
  showMessage('err', 'Speech recognition is not available in this browser.', 'Use Chrome or Edge.');
}

$('clear-log-button').onclick = () => {
  log.innerHTML = '<div class="empty">Nothing yet. Press Start speech recognition and say a keyword.</div>';
};

setupConnectButton({
  isOpen: () => worker.opened,
  open: (device) => worker.open(device),
  close: () => worker.close(),
});

confirmLeaveWhileConnected(() => worker.opened);
setupHowTo();
