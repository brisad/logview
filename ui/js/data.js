var DataSource = (function () {
  var _idCounter = 0;

  return {
    listenForLogs: function (parseLine, callback, errorCallback) {
      socket.emit('need logs');
      socket.on('streaming logs', function (line) {
        try {
          var message = parseLine(line);
        } catch (ex) {
          errorCallback(line, ex);
          return;
        }
        message.id = _idCounter++;
        callback(message);
      });
    }
  };
})();
