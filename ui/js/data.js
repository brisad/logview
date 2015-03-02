var DataSource = (function () {
  var _idCounter = 0;

  return {
    listenForLogs: function (parseLine, callback, errorCallback) {
      socket.emit('need logs');
      socket.on('loglines', function (lines) {

        // List of messages to pass to the callback
        var messages = [];

        // Parse each line we get and append it to the list of
        // messages.  Any error will be passed to the error callback.
        lines.forEach(function (line) {
          var message;
          try {
            message = parseLine(line);
          } catch (ex) {
            errorCallback(line, ex);
            return;
          }

          if (typeof message != "object") {
            errorCallback(line, new Error("parseLine didn't return a valid object"));
            return;
          }

          message.id = _idCounter++;
          messages.push(message);
        });

        callback(messages);
      });
    }
  };
})();
