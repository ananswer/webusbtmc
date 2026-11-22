// Small helpers shared by the samples: the connection bar, messages and the log.
// The page needs the elements #conn-dot, #conn-name, #conn-sub, #connect-button and #alerts.
// A page with several instruments gives each a prefix ('dmm1-' for #dmm1-conn-dot and so on) and
// puts the buttons that need that connection inside the element #dmm1-card.
'use strict';

const $ = (id) => document.getElementById(id);

const spinner = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>';

/**
 * Shows the state of the connection.
 * state: 'off' | 'busy' | 'on' | 'err'
 * Buttons marked with data-needs-connection are enabled only while connected.
 */
export function setConnectionState(state, { name = '', detail = '', error = '' } = {}, prefix = '') {
  const button = $(prefix + 'connect-button');
  const dot = $(prefix + 'conn-dot');
  dot.className = 'dot' + ({ on: ' ok', err: ' err', busy: ' busy' }[state] || '');

  const text = {
    off: ['Not connected', 'Connect an instrument with a USB cable.'],
    busy: ['Connecting…', 'Choose your instrument in the dialog of the browser.'],
    on: [name, detail],
    err: ['Could not connect', error],
  }[state];
  $(prefix + 'conn-name').textContent = text[0];
  $(prefix + 'conn-sub').textContent = text[1];

  button.disabled = state === 'busy';
  button.toggleAttribute('aria-busy', state === 'busy');
  button.classList.toggle('btn-primary', state !== 'on');
  button.classList.toggle('btn-outline-secondary', state === 'on');
  button.innerHTML = {
    off: 'Connect',
    busy: spinner + 'Connecting',
    on: 'Disconnect',
    err: 'Try again',
  }[state];

  (prefix ? $(prefix + 'card') : document).querySelectorAll('[data-needs-connection]').forEach((element) => {
    element.disabled = state !== 'on';
  });
}

/** Shows a message in the page. kind: 'err' | 'warn' | 'ok' */
export function showMessage(kind, title, body = '') {
  const box = document.createElement('div');
  box.className = 'msg ' + kind;
  box.setAttribute('role', 'alert');

  const icon = document.createElement('i');
  icon.className = 'bi ' + { err: 'bi-exclamation-octagon-fill', warn: 'bi-exclamation-triangle-fill', ok: 'bi-check-circle-fill' }[kind];
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('div');
  text.className = 'text';
  const heading = document.createElement('b');
  heading.textContent = title;
  text.append(heading);
  if (body) {
    text.append(body);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'x';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.addEventListener('click', () => box.remove());

  box.append(icon, text, close);
  $('alerts').replaceChildren(box);
}

export function clearMessages() {
  $('alerts').replaceChildren();
}

/** Turns an error of the driver or of WebUSB into a message a user can act on. */
export function showError(error) {
  const message = error && error.message ? error.message : String(error);

  switch (error && error.name) {
    case 'UsbtmcTimeoutError':
      showMessage('warn', 'No answer from the instrument.',
        'Write a query first (the command name is followed by “?”), or raise the timeout if the instrument is slow. The connection can still be used.');
      break;
    case 'UsbtmcProtocolError':
      showMessage('err', 'The instrument answered in an unexpected way.', message);
      break;
    case 'NetworkError':
    case 'SecurityError':
      showMessage('err', 'The instrument could not be used.',
        'It may be used by another program. Close NI-VISA, Keysight IO Libraries or similar tools. On Windows the WinUSB driver is required.');
      break;
    default:
      showMessage('err', (error && error.title) || 'Something went wrong.', message);   // a page can give its error a title
  }
}

/** Adds a line to the log. kind: 'tx' (sent), 'rx' (received) or 'info'. */
export function appendLog(log, kind, text) {
  if (log.querySelector('.empty')) {
    log.replaceChildren();   // also drops the white space around the placeholder
  }

  const line = document.createElement('div');
  line.className = 'ln';
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = new Date().toLocaleTimeString([], { hour12: false });
  const mark = document.createElement('span');
  mark.className = kind;
  mark.textContent = { tx: '→', rx: '←', info: '•' }[kind];
  const body = document.createElement('span');
  body.className = kind;
  body.textContent = text;
  line.append(time, mark, body);

  log.append(line);
  log.scrollTop = log.scrollHeight;
}

/** The text of the log, one line per entry, for copying. */
export function logText(log) {
  return [...log.querySelectorAll('.ln')]
    .map((line) => [...line.children].map((part) => part.textContent).join(' '))
    .join('\n');
}

const usbtmcFilters = [
  { 'classCode': 0xFE, 'subclassCode': 0x03, 'protocolCode': 0x01 },
];

function hex4(value) {
  return Number(value).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Connects the Connect button of the page.
 *   isOpen():      true while an instrument is connected
 *   open(device):  connects to the chosen USB device (async)
 *   close():       disconnects (async)
 *   onChange(state): optional, called with 'off' | 'busy' | 'on' | 'err'
 *   describe(device): optional, the { name, detail } to show while connected
 *   prefix: optional, for a page with several instruments (see the top of this file)
 *   filters: optional, the filters of the dialog of the browser (any USBTMC instrument by default)
 */
export function setupConnectButton({ isOpen, open, close, onChange = () => { }, describe = null, prefix = '', filters = usbtmcFilters }) {
  const button = $(prefix + 'connect-button');

  const change = (state, details) => {
    setConnectionState(state, details, prefix);
    onChange(state);
  };

  button.addEventListener('click', async () => {
    if (isOpen()) {
      try {
        await close();
      } catch (error) {
        showError(error);
      }
      clearMessages();
      change('off');
      return;
    }

    let device;
    try {
      device = await navigator.usb.requestDevice({ 'filters': filters });
    } catch (error) {
      if (error.name !== 'NotFoundError') {   // NotFoundError: the dialog was closed without choosing
        showError(error);
      }
      return;
    }

    clearMessages();
    change('busy');
    try {
      await open(device);
      change('on', describe ? describe(device) : {
        name: device.productName || 'USB instrument',
        detail: 'VID ' + hex4(device.vendorId) + ' · PID ' + hex4(device.productId),
      });
    } catch (error) {
      console.error(error);
      change('err', { error: (error && error.summary) || 'The instrument was found but could not be opened.' });
      showError(error);
    }
  });

  change('off');
}

/** Shows a spinner on the button while `operation` runs. Errors are shown in the page. */
export async function runWithSpinner(button, operation, isOpen) {
  const html = button.innerHTML;
  clearMessages();
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.innerHTML = spinner + html;
  try {
    await operation();
  } catch (error) {
    console.error(error);
    showError(error);
  } finally {
    button.innerHTML = html;
    button.removeAttribute('aria-busy');
    button.disabled = !isOpen();
  }
}

/** Asks before the page is left while an instrument is connected (leaving closes the connection). */
export function confirmLeaveWhileConnected(isOpen) {
  window.addEventListener('beforeunload', (event) => {
    if (isOpen()) {
      event.preventDefault();
    }
  });
}

/**
 * "How to use" dialog. The page provides
 *   <button id="howto-button">  and  <template id="howto-body" data-title="...">the text</template>.
 */
export function setupHowTo() {
  const template = $('howto-body');
  const button = $('howto-button');
  if (!template || !button) {
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.id = 'howto-modal';
  modal.tabIndex = -1;
  modal.setAttribute('aria-labelledby', 'howto-title');
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML =
    '<div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">' +
    '<div class="modal-content">' +
    '<div class="modal-header"><h5 class="modal-title" id="howto-title"></h5>' +
    '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
    '<div class="modal-body"></div>' +
    '<div class="modal-footer"><button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button></div>' +
    '</div></div>';
  modal.querySelector('.modal-title').textContent = template.dataset.title || 'How to use';
  modal.querySelector('.modal-body').append(template.content.cloneNode(true));
  document.body.append(modal);

  button.setAttribute('data-bs-toggle', 'modal');
  button.setAttribute('data-bs-target', '#howto-modal');
}
