"use strict";

/* Functions put in global scope to be accessible from the rule
 * functions which are created with the Function constructor. */

/* TODO: Add one more level after nav, for the nav */
function annotationMsg(text, level, nav) {
  return { text: text, level: level, nav: nav };
}

function makeNav(caption, level) {
  return { caption: caption, level: level };
}

var Rules = (function () {
  var _idCounter = 0;

  /* TODO: Remove */
  var _copy = function (data) {
    return JSON.parse(JSON.stringify(data));
  }

  /* Updates the function of the given rule.  |funcText| is a string
   * containing the implementation of the rule in JavaScript code.
   *
   * A real JavaScript function is created and attached to the rule.
   * If a real function cannot be created the rule is marked as
   * broken.  |rule| is modified in place.
   */
  var _setFunc = function (rule, funcText) {
    rule.broken = false;
    rule.funcText = funcText;
    try {
      rule.func = Util.toFunction(rule.funcText);
    } catch (ex) {
      rule.func = null;
      rule.broken = ex.toString();
    }
    return rule;
  }

  /* Returns a nav object from |obj|.  If |obj| is not an object, it
   * is set to the caption of the nav in hope of it being
   * representable as a string.
   */
  var _getNav = function (obj) {
    return (typeof obj != "object") ? { caption: obj } : obj;
  }

  /* Returns an annotation message from |obj|.  If |obj| is not an
   * object it is set to the text of the message in hope of it being
   * representable as a string.  In that case the level is set to
   * "info" by default.  A unique |id| of the message is set.
   */
  var _getAnnotationMessage = function (obj) {
    if (typeof obj == "object") {
      return { text: obj.text, level: obj.level,
               id: "ann-" + _idCounter++, annotation: true };
    } else {
      return { text: obj, level: "info",
               id: "ann-" + _idCounter++, annotation: true };
    }
  }

  var _getMessageAndNavFromAnnotationMessage = function (obj) {
    var ret = {};
    var nav;
    ret.message = _getAnnotationMessage(obj);
    if (obj.nav !== undefined) {
      nav = _getNav(obj.nav);
      ret.nav = $.extend(nav, {target: ret.message.id});
    }
    return ret;
  }

  /* Initializes rule list from a list of user defined rules.  Returns
   * the new list that can be used with functions of this module.
   */
  var init = function (userRules) {
    var rules = userRules.map(function (rule, i) {
      var copy = $.extend({}, rule);
      _setFunc(copy, copy.funcText);
      return copy;
    });
    return _freezeRules(rules);
  }

  var serialize = function (rules) {
    return rules.map(function (rule) {
      return $.extend({}, {name: rule.name, funcText: rule.funcText});
    });
  }

  /* Returns a mutable copy of |rules| */
  var _copyRules = function (rules) {
    return rules.map(function (rule) {
      return $.extend({}, rule);
    });
  }

  var _freezeRules = function (rules) {
    return Object.freeze(rules.map(function (rule) {
      return Object.freeze($.extend({}, rule));
    }));
  }

  var _checkIndex = function (rules, index) {
    if (index < 0 || index >= rules.length) {
      throw new Error("Index " + index + " out of bounds!");
    }
  }

  var disableRule = function (rules, index) {
    _checkIndex(rules, index);
    var rulesCopy = _copyRules(rules);
    rulesCopy[index].disabled = true;
    return _freezeRules(rulesCopy);
  }

  var enableRule = function (rules, index) {
    _checkIndex(rules, index);
    var rulesCopy = _copyRules(rules);
    delete rulesCopy[index].disabled;
    return _freezeRules(rulesCopy);
  }

  var moveRuleUp = function (rules, index) {
    _checkIndex(rules, index);
    if (index == 0) {
      return null;  // Already at top
    }
    var rulesCopy = _copyRules(rules);
    var tmp = rulesCopy[index];
    rulesCopy[index] = rulesCopy[index - 1];
    rulesCopy[index - 1] = tmp;
    return _freezeRules(rulesCopy);
  }

  var moveRuleDown = function (rules, index) {
    _checkIndex(rules, index);
    if (index == rules.length - 1) {
      return null;  // Already at bottom
    }
    var rulesCopy = _copyRules(rules);
    var tmp = rulesCopy[index];
    rulesCopy[index] = rulesCopy[index + 1];
    rulesCopy[index + 1] = tmp;
    return _freezeRules(rulesCopy);
  }

  var addRuleAt = function (rules, index) {
    if (index != 0) {
      // Adding at index 0 is always ok
      _checkIndex(rules, index);
    }
    var rulesCopy = _copyRules(rules);
    var newRule = _setFunc({}, "function (message, history) { }");
    newRule.name = "Untitled";
    rulesCopy.splice(index, 0, newRule);
    return _freezeRules(rulesCopy);
  }

  var deleteRule = function (rules, index) {
    _checkIndex(rules, index);
    var rulesCopy = _copyRules(rules);
    rulesCopy.splice(index, 1);
    return _freezeRules(rulesCopy);
  }

  var renameRule = function (rules, index, name) {
    _checkIndex(rules, index);
    var rulesCopy = _copyRules(rules);
    rulesCopy[index].name = name;
    return _freezeRules(rulesCopy);
  }

  var changeRule = function (rules, index, funcText) {
    _checkIndex(rules, index);
    var rulesCopy = _copyRules(rules);
    _setFunc(rulesCopy[index], funcText);
    return _freezeRules(rulesCopy);
  }

  /* Applies rules on every message in |messages|.
   *
   * Returns an object containing two members, |logs| and |navs|,
   * containing an array of all processed messages and an array of any
   * navigation items created.
   */
  var applyAll = function (rules, messages) {
    return messages.reduce(function (acc, message) {
      var result = applyRules(rules, message);

      if (result !== false) {
        acc.logs.push.apply(acc.logs, result.messages);
        acc.navs.push.apply(acc.navs, result.navs);
      }
      return acc;
    }, {logs: [], navs: []})
  }

  /* Applies every enabled rule in |rules|, in order, to the given
   * |message|.
   *
   * Returns an object with message data and navs data, or false if a
   * message shall be dropped.
   */
  var applyRules = function (rules, message) {
    var ruleResult;
    var msg = message;
    var id = message.id;
    var numRules = rules.length;
    var level = "";
    var navs = [];

    /* Extra messages that come before and after the processed
     * message */
    var before = [];
    var after = [];

    var result;

    if (id === undefined) {
      throw new Error("No id in message");
    }

    for (var i = 0; i < numRules; i++) {

      if (!(rules[i].disabled) && rules[i].func) {

        try {
          ruleResult = rules[i].func(_copy(msg));
        } catch (ex) {
          ruleResult = {};
        }

        // If a rule function returns false, we should drop the entire
        // message.  Immediately stop by returning false.
        if (ruleResult === false) {
          return false;
        }

        // If a rule function returns undefined, normally by not
        // returning anything, we do nothing but continue with the
        // next rule.
        if (ruleResult === undefined)
          continue;

        // TODO: Set broken here
        if (typeof ruleResult != "object") {
          continue;
        }

        if ('message' in ruleResult) {
          msg = ruleResult.message;
        }

        if ('level' in ruleResult) {
          level = ruleResult.level;
        }

        if ('before' in ruleResult) {
          result = _getMessageAndNavFromAnnotationMessage(ruleResult.before);
          before.push(result.message);
          if (result.nav !== undefined) navs.push(result.nav);
        }

        if ('nav' in ruleResult) {
          var nav = _getNav(ruleResult.nav);
          // Set nav target to be current message
          navs.push($.extend(nav, {target: id}));
        }

        if ('after' in ruleResult) {
          result = _getMessageAndNavFromAnnotationMessage(ruleResult.after);
          after.unshift(result.message);
          if (result.nav !== undefined) navs.push(result.nav);
        }
      }
    }

    return {
      messages: Array.concat(
        before,
        [{ data: msg, level: level, id: id, annotation: false }],
        after),
      navs: navs
    };
  }

  return {init: init,
          serialize: serialize,
          disableRule: disableRule,
          enableRule: enableRule,
          moveRuleUp: moveRuleUp,
          moveRuleDown: moveRuleDown,
          addRuleAt: addRuleAt,
          deleteRule: deleteRule,
          renameRule: renameRule,
          changeRule: changeRule,
          applyAll: applyAll,
          applyRules: applyRules};
})();
