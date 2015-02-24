"use strict";

/* This file handles loading of user data from the websocket server.
 * User data is defined in an .xml-file and contains rules and
 * functions needed for parsing and interpreting log data.
 */

var socket;

var User = (function () {
  var connected = $.Deferred();
  var outstandingCodeRequest = false;

  socket = io.connect();
  socket.on('connect', function() {
    connected.resolve();

    $(window).bind("beforeunload", function() {
      socket.disconnect();
    });
  });

  var fetchUserData = function () {
    var deferred = $.Deferred();

    $.when(connected).done(function () {
      if (outstandingCodeRequest) {
        deferred.reject("Request already in progress");
      }

      /* Ask server for code */
      socket.emit('need code');
      outstandingCodeRequest = true;

      /* Handle the reply */
      socket.once('code', function (data) {
        var userData = {};
        userData.tableColumns = data['columns'];
        userData.rules = data['rules'];
        try {
          userData.parseLine = Util.toFunction(data['parse_line']);
        } catch (ex) {
          deferred.reject("Parse line: " + ex);
          return;
        }

        outstandingCodeRequest = false;
        deferred.resolve(userData);
      });
    });
    return deferred.promise();
  };

  var saveRules = function (rules) {
    var deferred = $.Deferred();
    
    $.when(connected).done(function () {
      socket.emit('save rules', rules);
      deferred.resolve();
    });
    return deferred.promise();
  };


  return {
    fetchUserData: fetchUserData,
    saveRules: saveRules
  };
})();
