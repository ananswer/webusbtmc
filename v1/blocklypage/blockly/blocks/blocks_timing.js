'use strict';
Blockly.defineBlocksWithJsonArray([
  {
    "type": "wait_seconds",
    "message0": " wait %1 seconds",
    "args0": [{
      "type": "field_number",
      "name": "SECONDS",
      "min": 0,
      "max": 600,
      "value": 1
    }],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 230,
  }
]);

Blockly.JavaScript['wait_seconds'] = function(block) {
  var seconds = Number(block.getFieldValue('SECONDS'));
  var code = 'waitForSeconds(' + seconds + ');\n';
  return code;
};