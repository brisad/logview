var DataSource = (function () {
  var _idCounter = 0;

  return {
    listenForLogs: function (parseLine, callback, errorCallback) {
      socket.emit('need logs');
      socket.on('loglines', function (lines) {
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
          callback(message);
        });
      });
    }
  };
})();
