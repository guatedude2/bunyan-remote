var socketIO = require('socket.io');
var os = require('os');
var fs = require('fs');
var path = require('path');
var Promise = require('es6-promise').Promise;
var events = require('events');
var ClientArray = require('./client-array');
var packageJson = require('../package.json');


function checkAuth(authMethod, token) {
  return new Promise(function (accept, reject) {
    if (typeof authMethod === 'function') {
      var result = authMethod(token);

      if (typeof result === 'object' && typeof result.then === 'function') {
        return result.then(accept, reject);
      } else if (typeof result === 'function') {
        return result(accept, reject);
      } else if (result === true){
        return accept();
      }
    } else if (authMethod === token) {
      return accept();
    }
    reject();
  });
}

function checkIP(ipList, ip) {
  return ipList.reduce(function (result, exp) {
    var regExp = new RegExp('^' + exp
      .replace(/([.:])/g, '\$1')
      .replace(/\*/g, '.*') + '$');
    return regExp.test(ip) || result;
  }, false);
}

function BunyanRemote(options) {
  options = Object.assign({
    auth: BunyanRemote.AUTH_NONE,
    authenticate: function () { return true; }
  }, options);
  var tempFilename = path.join(os.tmpdir(), '/bunyan-' + Date.now());
  var fsStream = fs.createWriteStream(tempFilename, {flags: 'a', encoding: 'utf8'});
  var streamer = new events.EventEmitter();
  var io = socketIO(3232);
  io.clients = new ClientArray();

  // check client IP is in allowed list
  io.use(function (socket, next) {
    var clientIp = socket.handshake.address;

    if (!options.allowedIPs || checkIP(options.allowedIPs, clientIp)) return next();
    next(new Error('Connection closed'));
  });

  io.on('connection', function (socket) {

    // send server info
    socket.emit('info', {
      hostname: os.hostname(),
      version: packageJson.version,
      auth: options.auth || BunyanRemote.AUTH_NONE
    });

    // authentication
    socket.on('auth', function (payload) {
      var token = options.auth === BunyanRemote.AUTH_USER ? payload.user + ':' + payload.password : payload;
      var authFunc = options.authenticate;

      if (options.auth === BunyanRemote.AUTH_NONE) {
        authFunc = function () { return true; };
      }

      checkAuth(authFunc, token).then(function onAccept() {
        fs.readFile(tempFilename, {encoding: 'utf8'}, function (err, data) {
          var history = JSON.parse('[' + data.substr(0, data.length - 2) + ']');
          socket.emit('auth', { status: 'ok', history: history });
          io.clients.add(socket);
        });
      }, function onReject() {
        socket.emit('auth', { status: 'error', error: options.auth === BunyanRemote.AUTH_USER ? 'Invalid credentials' : 'Invalid key' });
        socket.disconnect(true);
      });
    });

    socket.on('disconnect', function(){
      io.clients.remove(socket);
    });
  });

  streamer.write = function (record) {
    io.clients.emit('log', record);
    fsStream.write(JSON.stringify(record) + ',\n');
  };

  return {
    type: 'raw',
    stream: streamer,
    level: 'debug',
  };
}

BunyanRemote.AUTH_NONE = 0;
BunyanRemote.AUTH_KEY = 1;
BunyanRemote.AUTH_USER = 2;

module.exports = BunyanRemote;