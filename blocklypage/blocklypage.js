'use strict';
var toolbox = document.getElementById('toolbox');
var blocklyArea = document.getElementById('blockly-collapse-area');
var blocklyDiv = document.getElementById('blocklyDiv');

var options = { 
  toolbox : toolbox, 
  collapse : false, 
  comments : false, 
  disable : false, 
  maxBlocks : Infinity, 
  trashcan : true, 
  horizontalLayout : false, 
  toolboxPosition : 'start', 
  css : true, 
  media : 'blockly/media/', 
  rtl : false, 
  scrollbars : true, 
  sounds : true, 
  oneBasedIndex : true, 
  grid : {
    spacing : 20, 
    length : 1, 
    colour : '#888', 
    snap : false
  }, 
  zoom : {
    controls : true, 
    wheel : true, 
    startScale : 1, 
    maxScale : 3, 
    minScale : 0.3, 
    scaleSpeed : 1.2
  }
};

const myWorkspace = Blockly.inject(blocklyDiv, options);

Blockly.Xml.domToWorkspace(document.getElementById('startBlocks'),myWorkspace);

const resizeBlocklyArea = function(e) {
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
  //blocklyDiv.style.top = y + 'px';
  blocklyDiv.style.width = blocklyArea.offsetWidth + 'px';
  //blocklyDiv.style.height = blocklyArea.offsetHeight + 'px';
  Blockly.svgResize(myWorkspace);
};
window.addEventListener('resize', resizeBlocklyArea, false);
resizeBlocklyArea();
Blockly.svgResize(myWorkspace);

// Exit is used to signal the end of a script.
Blockly.JavaScript.addReservedWords('exit');


var myInterpreter = null;
var runner;
let highlightPause = false;
let latestCode = '';

let classes = new Array();

const $deviceTable = $('#device-table');
const $runButton = $('#run-button');
const $saveButton = $('#save-button');
const $loadButton = $('#load-button');
const $output = $('#output-blockly-textarea');

const $blocklyArea = $('#blockly-area');
const $blocklyCollapseButton = $('#blockly-collapse-button');
const $blocklyButtonImage = $('#blockly-button-image');
const $blocklyCollapseArea = $('#blockly-collapse-area');

const $outputBlocklyArea = $('#output-blockly-area');
const $outputBlocklyCollapseButton = $('#output-blockly-collapse-button');
const $outputBlocklyButtonImage = $('#output-blockly-button-image');
const $outputBlocklyCollapseArea = $('#output-blockly-collapse-area');

$(document).ready(function () {
  let userStop = false;

  function initApi(interpreter, scope) {
    // Add an API function for the alert() block, generated for "text_print" blocks.
    var wrapper = function(text) {
      if ($output.val()) {
        $output.val($output.val() + '\n' + text);
      }
      else {
        $output.val(text);
      }
    };
    interpreter.setProperty(scope, 'alert', interpreter.createNativeFunction(wrapper));
  
    // Add an API function for the prompt() block.
    var wrapper = function(text) {
      text = text ? text.toString() : '';
      return interpreter.createPrimitive(prompt(text));
    };
    interpreter.setProperty(scope, 'prompt', interpreter.createNativeFunction(wrapper));
  
    // --start-- Add an API for the user blocks.
    // Ensure function name does not conflict with variable names.
    Blockly.JavaScript.addReservedWords('waitForSeconds');
  
    var wait = function(timeInSeconds) {
      //return new Promise(resolve => setTimeout(resolve, (timeInSeconds * 1000), name));
      return new Promise(resolve => setTimeout(function() { console.log('elapsed'); resolve('done'); }, (timeInSeconds * 1000)));
    };
  
    var wrapper = function(timeInSeconds, callback) {
      // Delay the call to the callback.
      wait(timeInSeconds).then(callback);
    };
  
    interpreter.setProperty(scope, 'waitForSeconds', interpreter.createAsyncFunction(wrapper));
  
    Blockly.JavaScript.addReservedWords('webusbtmcClear');
  
    var wrapper = function(index, callback) {
      classes[index].clear().then(callback).catch((error) => {console.log(error);});
    };
  
    interpreter.setProperty(scope, 'webusbtmcClear', interpreter.createAsyncFunction(wrapper));
    
    Blockly.JavaScript.addReservedWords('webusbtmcReadSb');
  
    var wrapper = function(index, callback) {
      classes[index].readStatusByteRegister().then(callback).catch((error) => {console.log(error);});
    };
  
    interpreter.setProperty(scope, 'webusbtmcReadSb', interpreter.createAsyncFunction(wrapper));
    
    Blockly.JavaScript.addReservedWords('webusbtmcWrite');
  
    var wrapper = function(text, index, callback) {
      classes[index].write(text).then(callback).catch((error) => {console.log(error);});
    };
  
    interpreter.setProperty(scope, 'webusbtmcWrite', interpreter.createAsyncFunction(wrapper));
    
    Blockly.JavaScript.addReservedWords('webusbtmcRead');
  
    var wrapper = function(value, index, callback) {
      classes[index].read(value).then(callback).catch((error) => {console.log(error);});
    };
  
    interpreter.setProperty(scope, 'webusbtmcRead', interpreter.createAsyncFunction(wrapper));
    
    Blockly.JavaScript.addReservedWords('convert');
    var wrapper = function(bytes) {
      return convert(bytes);
    };
    //interpreter.setProperty(scope, 'convert', convert);
    interpreter.setProperty(scope, 'convert', interpreter.createNativeFunction(wrapper));
    // --end-- Add an API for the user blocks.
  
    // Add an API function for highlighting blocks.
    var wrapper = function(id) {
      id = id ? id.toString() : '';
      return interpreter.createPrimitive(highlightBlock(id));
    };
    interpreter.setProperty(scope, 'highlightBlock',
        interpreter.createNativeFunction(wrapper));
  }
  
  function highlightBlock(id) {
    myWorkspace.highlightBlock(id);
    highlightPause = true;
  }
  
  function resetStepUi(clearOutput) {
    myWorkspace.highlightBlock(null);
    highlightPause = false;
  
    if (clearOutput) {
      $output.val('');
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

  // Load the interpreter now, and upon future changes.
  generateCodeAndLoadIntoInterpreter();
  myWorkspace.addChangeListener(function(event) {
    if (!(event instanceof Blockly.Events.Ui)) {
      // Something changed. Parser needs to be reloaded.
      resetInterpreter();
      generateCodeAndLoadIntoInterpreter();
    }
  });
  
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

    let max = classes.length;

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

    $runButton.html('Running');
    $saveButton.prop('disabled', true);
    $loadButton.prop('disabled', true);

    // First statement of this code.
    // Clear the program output.
    resetStepUi(true);

    setTimeout(function() {
      /*
      alert('Ready to execute the following code\n' +
        '===================================\n' +
        latestCode);
      */

      $output.val('<< Program begin >>');

      // Begin execution
      highlightPause = false;
      myInterpreter = new Interpreter(latestCode, initApi);
      runner = function() {
        if (myInterpreter) {
          var hasMore = myInterpreter.run();
          if (hasMore && !userStop) {
            // Execution is currently blocked by some async call.
            // Try again later.
            setTimeout(runner, 10);
          } else {
            // Program is complete.
            $output.val($output.val() + '\n' + '<< Program complete >>');
            resetInterpreter();
            resetStepUi(false);
            $runButton.html('Run');
            $saveButton.prop('disabled', false);
            $loadButton.prop('disabled', false);
          }
        }
      };
      runner();
    }, 1);
  }

  $runButton.on('click', function () {
    if ($runButton.html()=='Run') {
      userStop =  false;
      runCode();
    }
    else {
      userStop =  true;
    }
  });

  $saveButton.prop('disabled', false).on('click', function() {
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
  });

  $loadButton.prop('disabled', false).on('click', function() {
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
  });

  $blocklyCollapseButton.click(function(){
    const isShowBlockly = $blocklyCollapseArea.is('.collapse.show');
    const isShowOutput = $outputBlocklyCollapseArea.is('.collapse.show');
    if (isShowBlockly && isShowOutput) {
      $blocklyArea.removeClass().addClass('col-md-12');
      $outputBlocklyArea.removeClass().addClass('col-md-12');
      $blocklyCollapseArea.collapse('hide');
      $blocklyButtonImage.attr('src','svg/caret-down-square.svg');
    }
    else {
      if (isShowOutput) {
        $blocklyArea.removeClass().addClass('col-md-8');
        $outputBlocklyArea.removeClass().addClass('col-md-4');
      }
      $blocklyCollapseArea.collapse('show');
      $blocklyButtonImage.attr('src','svg/caret-up-square.svg');
    }
  });

  $outputBlocklyCollapseButton.click(function(){
    const isShowBlockly = $blocklyCollapseArea.is('.collapse.show');
    const isShowOutput = $outputBlocklyCollapseArea.is('.collapse.show');
    if (isShowBlockly && isShowOutput) {
      $blocklyArea.removeClass().addClass('col-md-12');
      $outputBlocklyArea.removeClass().addClass('col-md-12');
      $outputBlocklyCollapseArea.collapse('hide');
      $outputBlocklyButtonImage.attr('src','svg/caret-down-square.svg');
    }
    else {
      if (isShowBlockly) {
        $blocklyArea.removeClass().addClass('col-md-8');
        $outputBlocklyArea.removeClass().addClass('col-md-4');
      }
      $outputBlocklyCollapseArea.collapse('show');
      $outputBlocklyButtonImage.attr('src','svg/caret-up-square.svg');
    }
  });

  $outputBlocklyCollapseArea.on('shown.bs.collapse', function(){
    resizeBlocklyArea();
  });

  $outputBlocklyCollapseArea.on('hidden.bs.collapse', function(){
    resizeBlocklyArea();
  });

  function addElement(index) {
    var rowCount = $('#myTable tr').length - 1;

    if (rowCount >= 8) {
      return;
    }

    const frontPart = `
    <tr class="hide">
      <td scope="row" class="text-left">
        <span class="table-index">
    `;

    const endPart = `
        </span>
      </td>
      <td class="text-left">-</td>
      <td class="text-left">
        <span class="table-register">
          <button type="button" class="btn btn-primary btn-rounded btn-sm">Attach</button>
        </span>
      </td>
    </tr>
    `;

    $('tbody').append(frontPart + index + endPart);

  }

  $deviceTable.on('click', '.table-register', function () {
    const $row = $(this).parents('tr');
    const index = $row.index();
    const text = $row.get(0).children[1];
    text.innerHTML = '-';
    const button = $row.get(0).children[2].children[0].children[0];

    if (button.textContent === 'Attach') {
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
            text.innerHTML = result.manufacturerName + ' ' + result.productName + ' ' + result.serialNumber;
            classes.push(tmc);
            addElement(index + 1);
            button.classList.remove("btn-primary");
            button.classList.add("btn-danger");
            button.textContent = 'Dettach';
            }).catch((error) => {
              alert(error);
          });
        
        }
  
      }).catch((error) => {
        console.log(error);
      });  
    }
    else {
      if (classes.length > index) {
        classes[index].close();
        classes.splice(index, 1);
      }
  
      var $rows = $(this).parents('tbody');
      if ($rows.get(0).children.length <= 1) {
        $(this).parents('tr').remove();
        addElement(0);
        return;
      }
  
      let tmpIndex = 0;
      let contents = $rows.find(".table-index")
      for(let i = 0; i < contents.length; i++){
        if (i != index) {
          contents[i].innerHTML = tmpIndex;
          tmpIndex++  
        }
      }
  
      $(this).parents('tr').remove();
    }

  });

});
