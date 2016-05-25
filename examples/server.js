var bunyan = require('bunyan');
var http = require('http');

var remoteBunyan = require('../index');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write('<html><body>\
      <script src="https://cdn.socket.io/socket.io-1.4.5.js"></script>\
      <script>\
        var socket = io("http://localhost:3232");\
        socket.on("connect", function(){\
          console.log("OK");\
        });\
        socket.on("log", function(data){\
          console.log("THIS IS A LOG EXAMPLE BLAH BLAH", data);\
        });\
        socket.on("disconnect", function(){});\
      </script></body></html>');
  res.end();
}).listen(8000);


var logger = bunyan.createLogger({
  name: 'example-app'
});

logger.addStream(remoteBunyan({
  allowedIPs: ['*'],
  auth: remoteBunyan.AUTH_KEY,
  authenticate: 'ABC:DEF'
}));


logger.info('Start server...');

var count = 0;
setInterval(function () {
  logger.info('Counter at ' + (++count));
  logger.warn('Some Object', {test: 1, cool: 'abc', 'obj': { stuff: 123} });
  logger.error(new Error('TEST'), 'Oh noes!');
  var child = logger.child({ test: 'abc' });
  child.info('OK');
}, 1000);

