var DataSource = (function () {
  var _idCounter = 0;

  return {
    listenForLogs: function (parseLine, callback, errorCallback) {
      socket.emit('need logs');
      socket.on('loglines', function (lines) {
        lines.forEach(function (line) {
          try {
            var message = parseLine(line);
          } catch (ex) {
            errorCallback(line, ex);
            return;
          }
          message.id = _idCounter++;
          callback(message);
        });
      });
    }
  };
})();
