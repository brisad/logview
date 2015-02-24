"use strict";

var Util = (function () {
  var _funcRegex = /^function[ a-z]*\(([^)]*)\)\s*{([\s\S]*)}$/i;

  /* Creates a JavaScript function object from string. */
  var toFunction = function (functionText) {
    var match = _funcRegex.exec(functionText);
    if (!match) return null;
    return new Function(match[1].split(","), match[2]);
  }

  return { toFunction: toFunction };
})();
