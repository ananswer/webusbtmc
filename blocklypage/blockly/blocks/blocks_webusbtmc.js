'use strict';
Blockly.defineBlocksWithJsonArray([
  {
    "type": "clear_device",
    "message0": "clear device %1",
    "args0": [
      {
        "type": "field_number",
        "name": "INDEX",
        "check": "Number",
        "min": 0,
        "max": 7,
        "value": 0
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180,
    "tooltip": "Clear the device",
    "helpUrl": "-"
  },
  {
    "type": "read_status_byte_from_device",
    "message0": "read status byte from device %1",
    "args0": [
      {
        "type": "field_number",
        "name": "INDEX",
        "check": "Number",
        "min": 0,
        "max": 7,
        "value": 0
      }
    ],
    "inputsInline": true,
    "output": "Number",
    "colour": 180,
    "tooltip": "Read status byte from the device",
    "helpUrl": "-"
  },
  {
    "type": "read_from_device",
    "message0": "read %1 bytes from device %2",
    "args0": [
      {
        "type": "field_number",
        "name": "VALUE",
        "check": "Number",
        "min": 64,
        "max": 2147483647,
        "value": 1024
      },
      {
        "type": "field_number",
        "name": "INDEX",
        "check": "Number",
        "min": 0,
        "max": 7,
        "value": 0
      }
    ],
    "inputsInline": true,
    "output": "String",
    "colour": 180,
    "tooltip": "Read message from the device",
    "helpUrl": "-"
  },
  {
    "type": "write_to_device",
    "message0": "write %1 to device %2",
    "args0": [
      {
        "type": "input_value",
        "name": "TEXT",
        "check": "String"
      },
      {
        "type": "field_number",
        "name": "INDEX",
        "check": "Number",
        "min": 0,
        "max": 7,
        "value": 0
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180,
    "tooltip": "Send command to the device",
    "helpUrl": "-"
  }
]);

function changeHUE(index) {
  var hue = 360*index/8 + 180;
  if (hue > 360) {
    hue -= 360;
  }
  return hue;
}

Blockly.JavaScript['clear_device'] = function(block) {
  var index = block.getFieldValue('INDEX');  
  var hue = changeHUE(index);
  block.setColour(hue);
  var code = 'webusbtmcClear(' + index +');\n';
  return code;
};

Blockly.JavaScript['read_status_byte_from_device'] = function(block) {
  var index = block.getFieldValue('INDEX');
  var hue = changeHUE(index);
  block.setColour(hue);
  var code = 'webusbtmcReadSb('+ index +')';
  return [code, Blockly.JavaScript.ORDER_NONE];
};

Blockly.JavaScript['read_from_device'] = function(block) {
  var value = block.getFieldValue('VALUE');
  var index = block.getFieldValue('INDEX');
  var hue = changeHUE(index);
  block.setColour(hue);
  var code = 'webusbtmcRead(' + value + ',' + index +')';
  return [code, Blockly.JavaScript.ORDER_NONE];
};

Blockly.JavaScript['write_to_device'] = function(block) {
  var text = Blockly.JavaScript.valueToCode(block, 'TEXT', Blockly.JavaScript.ORDER_ATOMIC);
  var index = block.getFieldValue('INDEX');
  var hue = changeHUE(index);
  block.setColour(hue);
  var code = 'webusbtmcWrite(' + text + ',' + index +');\n';
  return code;
};
