'use strict';

import Webusbtmc from '../webusbtmc/webusbtmc.js';

const navbarTogglerButton = document.getElementById('navbarNavDropdown');

const newButton = document.getElementById('new_button');
const openButton = document.getElementById('open_button');
const saveButton = document.getElementById('save_button');


const deviceButton = document.getElementById('settings_button');
const codeButton = document.getElementById('code_button');

const devicePanel = document.getElementById('settings_panel');
const codePanel = document.getElementById('code_panel');


const deviceTable = document.getElementById('device-table');
const addDeviceButton = document.getElementById('add-device-button');
const removeDeviceButton = document.getElementById('remove-device-button');


const blocklyButton = document.getElementById('blockly-button');
const bothSideButton = document.getElementById('bothside-button');
const outPutButton = document.getElementById('output-button');
const runButton = document.getElementById('run-button');
const clearOutputButton = document.getElementById('clear-output-button');

const blocklyAreaColumn = document.getElementById('blockly-area-column');
const outputAreaColumn = document.getElementById('output-area-column');

const toolbox = document.getElementById('toolbox');
const blocklyDiv = document.getElementById('blocklyDiv');
const blocklyArea = document.getElementById('blocklyArea');
const outputArea = document.getElementById('outputArea');




const options = {
  toolbox: toolbox,
  collapse: false,
  comments: false,
  disable: false,
  maxBlocks: Infinity,
  trashcan: true,
  horizontalLayout: false,
  toolboxPosition: 'start',
  css: true,
  media: 'blockly/media/',
  rtl: false,
  scrollbars: true,
  sounds: true,
  oneBasedIndex: true,
  grid: {
    spacing: 20,
    length: 1,
    colour: '#888',
    snap: false
  },
  zoom: {
    controls: true,
    wheel: true,
    startScale: 1,
    maxScale: 3,
    minScale: 0.3,
    scaleSpeed: 1.2
  }
};

const myWorkspace = Blockly.inject(blocklyDiv, options);

Blockly.Xml.domToWorkspace(document.getElementById('startBlocks'), myWorkspace);

const resizeBlocklyArea = function (e) {
  // Compute the absolute coordinates and dimensions of blocklyArea.
  var element = blocklyArea;
  var x = 0;
  var y = 0;
  do {
    x += element.offsetLeft;
    y += element.offsetTop;
    element = element.offsetParent;
  } while (element);
  // Position blocklyDiv over blocklyArea.
  blocklyDiv.style.left = x + 'px';
  blocklyDiv.style.top = y + 'px';
  blocklyDiv.style.width = blocklyArea.offsetWidth + 'px';
  blocklyDiv.style.height = window.innerHeight - 120 + 'px';
  outputArea.style.height = window.innerHeight - 120 + 'px';

  Blockly.svgResize(myWorkspace);
};

window.addEventListener('resize', resizeBlocklyArea, false);
resizeBlocklyArea();
Blockly.svgResize(myWorkspace);

// Exit is used to signal the end of a script.
Blockly.JavaScript.addReservedWords('exit');


var myInterpreter = null;
var runner;
let latestCode = '';

let resources = new Array();

let stopRunning = false;

function initApi(interpreter, scope) {
  // Add an API function for the alert() block, generated for "text_print" blocks.
  var wrapper = function (text) {
    if (outputArea.innerText.length !== 0) {
      outputArea.innerText += '\n' + text;
    }
    else {
      outputArea.innerText = text;
    }
  };
  interpreter.setProperty(scope, 'alert', interpreter.createNativeFunction(wrapper));

  // Add an API function for the prompt() block.
  var wrapper = function (text) {
    text = text ? text.toString() : '';
    return interpreter.createPrimitive(prompt(text));
  };
  interpreter.setProperty(scope, 'prompt', interpreter.createNativeFunction(wrapper));

  // --start-- Add an API for the user blocks.
  // Ensure function name does not conflict with variable names.
  Blockly.JavaScript.addReservedWords('waitForSeconds');

  var wait = function (timeInSeconds) {
    //return new Promise(resolve => setTimeout(resolve, (timeInSeconds * 1000), name));
    return new Promise(resolve => setTimeout(function () { console.log('elapsed'); resolve('done'); }, (timeInSeconds * 1000)));
  };

  var wrapper = function (timeInSeconds, callback) {
    // Delay the call to the callback.
    wait(timeInSeconds).then(callback);
  };

  interpreter.setProperty(scope, 'waitForSeconds', interpreter.createAsyncFunction(wrapper));

  Blockly.JavaScript.addReservedWords('webusbtmcClear');

  var wrapper = function (index, callback) {
    // for WebUSBTMC
    resources[index].clear().then(callback).catch((error) => { console.log(error); });
  };

  interpreter.setProperty(scope, 'webusbtmcClear', interpreter.createAsyncFunction(wrapper));

  Blockly.JavaScript.addReservedWords('webusbtmcReadSb');

  var wrapper = function (index, callback) {
    // for WebUSBTMC
    resources[index].readStatusByteRegister().then(callback).catch((error) => { console.log(error); });
  };

  interpreter.setProperty(scope, 'webusbtmcReadSb', interpreter.createAsyncFunction(wrapper));

  Blockly.JavaScript.addReservedWords('webusbtmcWrite');

  var wrapper = function (text, index, callback) {
    // for WebUSBTMC
    resources[index].write(text).then(callback).catch((error) => { console.log(error); });
  };

  interpreter.setProperty(scope, 'webusbtmcWrite', interpreter.createAsyncFunction(wrapper));

  Blockly.JavaScript.addReservedWords('webusbtmcRead');

  var wrapper = function (value, index, callback) {
    // for WebUSBTMC
    resources[index].read(value).then(callback).catch((error) => { console.log(error); });
  };

  interpreter.setProperty(scope, 'webusbtmcRead', interpreter.createAsyncFunction(wrapper));

  Blockly.JavaScript.addReservedWords('convert');
  var wrapper = function (bytes) {
    return convert(bytes);
  };
  //interpreter.setProperty(scope, 'convert', convert);
  interpreter.setProperty(scope, 'convert', interpreter.createNativeFunction(wrapper));
  // --end-- Add an API for the user blocks.

  // Add an API function for highlighting blocks.
  var wrapper = function (id) {
    id = id ? id.toString() : '';
    return interpreter.createPrimitive(highlightBlock(id));
  };
  interpreter.setProperty(scope, 'highlightBlock',
    interpreter.createNativeFunction(wrapper));
}

function highlightBlock(id) {
  myWorkspace.highlightBlock(id);
}

function resetStepUi(clearOutput) {
  myWorkspace.highlightBlock(null);

  if (clearOutput) {
    outputArea.innerText = '';
  }
}

function generateCodeAndLoadIntoInterpreter() {
  // Generate JavaScript code and parse it.
  Blockly.JavaScript.STATEMENT_PREFIX = 'highlightBlock(%1);\n';
  Blockly.JavaScript.addReservedWords('highlightBlock');
  latestCode = Blockly.JavaScript.workspaceToCode(myWorkspace);

  resetStepUi(false);
}

function resetInterpreter() {
  myInterpreter = null;
  if (runner) {
    clearTimeout(runner);
    runner = null;
  }
}

function isDeviceValid() {
  const indexes = new Array();
  var blocks = Blockly.mainWorkspace.getBlocksByType('write_to_device')
  blocks.forEach(block => {
    const value = block.getFieldValue('INDEX');
    indexes.push(value);
  });

  var blocks = Blockly.mainWorkspace.getBlocksByType('read_from_device')
  blocks.forEach(block => {
    const value = block.getFieldValue('INDEX');
    indexes.push(value);
  });

  var blocks = Blockly.mainWorkspace.getBlocksByType('clear_device')
  blocks.forEach(block => {
    const value = block.getFieldValue('INDEX');
    indexes.push(value);
  });

  var blocks = Blockly.mainWorkspace.getBlocksByType('read_status_byte_from_device')
  blocks.forEach(block => {
    const value = block.getFieldValue('INDEX');
    indexes.push(value);
  });

  let unique = [...new Set(indexes)];

  let max = resources.length;

  if (max <= 0 && unique.length > 0) {
    alert('No devices');
    return false;
  }

  let alertText = '';
  unique.forEach(value => {
    if (value > (max - 1)) {
      alertText += value + ', ';
    }
  });

  if (alertText != '') {
    alert('Device' + alertText + 'are missing');
    return false;
  }

  return true;
}

function runCode() {
  if (myInterpreter) {
    return;
  }

  if (!isDeviceValid()) {
    return;
  }

  runButton.innerHTML = 'Running';
  newButton.disabled = true;
  saveButton.disabled = true;
  openButton.disabled = true;
  addDeviceButton.disabled = true;
  removeDeviceButton.disabled = true;

  // First statement of this code.
  // Clear the program output.
  resetStepUi(true);

  setTimeout(function() {
    /*
    alert('Ready to execute the following code\n' +
      '===================================\n' +
      latestCode);
    */

    outputArea.innerText = '<< Program begin >>';

    // Begin execution
    myInterpreter = new Interpreter(latestCode, initApi);
    runner = () => {
      if (myInterpreter) {
        var hasMore = myInterpreter.run();
        if (hasMore && !stopRunning) {
          // Execution is currently blocked by some async call.
          // Try again later.
          setTimeout(runner, 10);
        } else {
          // Program is complete.
          outputArea.innerText += '\n' + '<< Program complete >>';
          resetInterpreter();
          resetStepUi(false);
          runButton.innerHTML = 'Run';
          newButton.disabled = false;
          saveButton.disabled = false;
          openButton.disabled = false;
          addDeviceButton.disabled = false;
          removeDeviceButton.disabled = false;
        }
      }
    };
    runner();
  }, 1);
}

// Load the interpreter now, and upon future changes.
generateCodeAndLoadIntoInterpreter();
myWorkspace.addChangeListener(function (event) {
  if (!(event instanceof Blockly.Events.Ui)) {
    // Something changed. Parser needs to be reloaded.
    resetInterpreter();
    generateCodeAndLoadIntoInterpreter();
  }
});

deviceButton.onclick = () => {
  devicePanel.classList.remove(...devicePanel.classList);
  codePanel.classList.remove(...codePanel.classList);
  devicePanel.classList.add('container-fluid');
  codePanel.classList.add('d-none');
};

codeButton.onclick = () => {
  devicePanel.classList.remove(...devicePanel.classList);
  codePanel.classList.remove(...codePanel.classList);
  devicePanel.classList.add('d-none');
  codePanel.classList.add('container-fluid');
};

blocklyButton.onclick = () => {
  blocklyAreaColumn.classList.remove(...blocklyAreaColumn.classList);
  blocklyAreaColumn.classList.add('col-md-12');
  outputAreaColumn.classList.remove(...outputAreaColumn.classList);
  outputAreaColumn.classList.add('d-none');
  resizeBlocklyArea();
};

bothSideButton.onclick = () => {
  blocklyAreaColumn.classList.remove(...blocklyAreaColumn.classList);
  blocklyAreaColumn.classList.add('col-md-8');
  outputAreaColumn.classList.remove(...outputAreaColumn.classList);
  outputAreaColumn.classList.add('col-md-4');
  resizeBlocklyArea();
};

outPutButton.onclick = () => {
  blocklyAreaColumn.classList.remove(...blocklyAreaColumn.classList);
  blocklyAreaColumn.classList.add('d-none');
  outputAreaColumn.classList.remove(...outputAreaColumn.classList);
  outputAreaColumn.classList.add('col-md-12');
  resizeBlocklyArea();
};

navbarTogglerButton.addEventListener('transitionend', () => {
  resizeBlocklyArea();
});

clearOutputButton.onclick = () => {
  outputArea.innerText = '';
}

runButton.onclick = () => {
  if (runButton.innerHTML === 'Run') {
    stopRunning =  false;
    runCode();
  }
  else {
    stopRunning =  true;
  }  
}

addDeviceButton.onclick = ()=> {
  const rowsLength = deviceTable.rows.length - 1;

  if(rowsLength >= 6) {
    return;
  }

  const filters = [
    {'classCode': 0xFE, 'subclassCode': 0x03, 'protocolCode': 0x01},
  ];
  navigator.usb.requestDevice({'filters': filters}).then((result) => {
    if (result.opened){
      alert(result.productName + ' is already attached');
    }
    else {
      const tmc = new Webusbtmc();
      tmc.open(result).then(() => {
        resources.push(tmc);

        const row = deviceTable.insertRow(-1);
        const cell0 = row.insertCell(0);
        const cell1 = row.insertCell(1);
        const cell2 = row.insertCell(2);
        cell0.innerHTML = '<input class="form-check-input" type="checkbox" value="">'
        cell1.innerHTML = rowsLength;
        cell2.innerHTML = result.manufacturerName + ' ' + result.productName + ' ' + result.serialNumber;
      
        }).catch((error) => {
          alert(error);
      });
    
    }

  }).catch((error) => {
    console.log(error);
  });  

}

removeDeviceButton.onclick = ()=> {
  for(let i=1; i < deviceTable.rows.length; i++ ){
    let input = deviceTable.rows[i].querySelector('input');
    if(input.checked) {
      resources[i-1].close();
      resources.splice(i-1, 1);
      deviceTable.deleteRow(i);
      i--;
    }
  }

  for(let i=1; i < deviceTable.rows.length; i++ ){
    let row = deviceTable.rows[i];
    row.cells[1].innerText = i - 1;
  }
}


newButton.onclick = ()=> {
  Blockly.mainWorkspace.clear();
  Blockly.Xml.domToWorkspace(document.getElementById('startBlocks'), Blockly.mainWorkspace);
}

openButton.onclick = ()=> {
  var input = document.createElement('input');
  input.type = 'file';

  input.onchange = e => { 

    var file = e.target.files[0]; 
    var reader = new FileReader();
    reader.fileName = file.name // file came from a input file element. file = el.files[0];

    reader.readAsText(file,'UTF-8');

    // here we tell the reader what to do when it's done reading...
    reader.onload = readerEvent => {
      var target = readerEvent.target;
      // 2 == FileReader.DONE
      if (target.readyState == 2) {
        try {
          var xml = Blockly.Xml.textToDom(target.result);
        } catch (e) {
          alert('Error parsing XML:\n' + e);
          return;
        }
        var count = Blockly.mainWorkspace.getAllBlocks().length;
        if (count && confirm('Replace existing blocks?\n"Cancel" will merge.')) {
          Blockly.mainWorkspace.clear();
        }
        Blockly.Xml.domToWorkspace(Blockly.mainWorkspace, xml);
      }

    }

  }

  input.click();
  
}

saveButton.onclick = ()=> {
  var xmlDom = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace);
  var xmlText = Blockly.Xml.domToPrettyText(xmlDom);
  var fileName = window.prompt('What would you like to name your file?', 'example');

  if(fileName){
    var blob = new Blob([xmlText], {type: 'text/xml'});
    var link = document.createElement('a');
    link.href = window.URL.createObjectURL( blob );
    link.download = fileName + ".xml";
    link.click();
    
  } 

}
