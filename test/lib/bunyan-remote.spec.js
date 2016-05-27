var expect = require('chai').expect;
var http = require('http');
var io = require('socket.io-client');

var bunyanRemote = require('../../lib/bunyan-remote');

var stream, socket;
describe('bunyan-remote', function () {

  afterEach(function () {
    socket.close();
    stream.destroy();
  });

  it('should create a bunyan stream with the default options', function (done) {
    stream = bunyanRemote();
    expect(stream).to.have.all.keys('type', 'stream', 'level', 'attach', 'destroy');
    expect(stream.type).to.equal('raw');
    expect(stream.level).to.equal('debug');

    socket = io.connect('http://localhost:3232');
    socket.on('connect', function () {
      done();
    });
    socket
  });

  it('should create a bunyan stream on a custom port', function (done) {
    stream = bunyanRemote({
      port: 2424
    });

    socket = io.connect('http://localhost:2424');
    socket.on('connect', function () {
      done();
    });
  });

  it('should create a bunyan stream with a custom server', function (done) {
    var server = http.Server();
    stream = bunyanRemote({
      server: server
    });

    server.listen(4242);

    socket = io.connect('http://localhost:4242');
    socket.on('connect', function () {
      done();
    });

  });

  it('should reject a client when the IP does not match any of the `options.allowedIPs`', function (done) {
    stream = bunyanRemote({
      allowedIPs: ['1.1.1.1']
    });

    socket = io.connect('http://localhost:3232');
    socket.on('disconnect', function () {
      done();
    });
  });

  it('should allow a client when the IP matches part of an expression with wildcards in `options.allowedIPs`', function (done) {
    stream = bunyanRemote({
      allowedIPs: ['127.*']
    });

    socket = io.connect('http://localhost:3232');
    socket.on('info', function () {
      done();
    });
  });

  it('should emit an "info" event upon connection', function (done) {
    stream = bunyanRemote();

    socket = io.connect('http://localhost:3232');
    socket.on('info', function (info) {
      expect(info).to.have.all.keys('hostname', 'version', 'auth');
      done();
    });
  });


  it('should handle authentication with and error when authentication fails', function (done) {
    stream = bunyanRemote({
      auth: bunyanRemote.AUTH_KEY,
      authenticate: 'CDE'
    });

    socket = io.connect('http://localhost:3232');
    socket.on('info', function (info) {
      expect(info.auth).to.equal(bunyanRemote.AUTH_KEY);
      socket.emit('auth', 'ABC');
    });
    socket.on('auth', function (response) {
      expect(response).to.deep.equal({
        status: 'error',
        error: 'Invalid key'
      });
      done();
    });
  });

  it('should handle authentication when authenticating with a string', function (done) {
    stream = bunyanRemote({
      auth: bunyanRemote.AUTH_KEY,
      authenticate: 'ABC'
    });

    socket = io.connect('http://localhost:3232');
    socket.on('info', function (info) {
      expect(info.auth).to.equal(bunyanRemote.AUTH_KEY);
      socket.emit('auth', 'ABC');
    });
    socket.on('auth', function (response) {
      expect(response).to.deep.equal({
        status: 'ok',
        history: []
      });
      done();
    });
  });

  it('should handle authentication when authenticating with a function', function (done) {
    stream = bunyanRemote({
      auth: bunyanRemote.AUTH_KEY,
      authenticate: function (token) {
        return 'ABC' === token;
      }
    });

    socket = io.connect('http://localhost:3232');
    socket.on('info', function (info) {
      expect(info.auth).to.equal(bunyanRemote.AUTH_KEY);
      socket.emit('auth', 'ABC');
    });
    socket.on('auth', function (response) {
      expect(response).to.deep.equal({
        status: 'ok',
        history: []
      });
      done();
    });
  });

  it('should handle authentication when authenticating with an asynchronous function', function (done) {
    stream = bunyanRemote({
      auth: bunyanRemote.AUTH_KEY,
      authenticate: function (token) {
        return function (accept, reject) {
          setTimeout(function () {
            if (token === 'ABC') {
              accept();
            } else {
              reject();
            }
          }, 10);
        };
      }
    });

    socket = io.connect('http://localhost:3232');
    socket.on('info', function (info) {
      expect(info.auth).to.equal(bunyanRemote.AUTH_KEY);
      socket.emit('auth', 'ABC');
    });
    socket.on('auth', function (response) {
      expect(response).to.deep.equal({
        status: 'ok',
        history: []
      });
      done();
    });
  });


  it('should handle authentication when `option.auth` is AUTH_NONE', function (done) {
    stream = bunyanRemote({
      auth: bunyanRemote.AUTH_NONE
    });

    socket = io.connect('http://localhost:3232');
    socket.on('info', function (info) {
      expect(info.auth).to.equal(bunyanRemote.AUTH_NONE);
      socket.emit('auth');
    });
    socket.on('auth', function (response) {
      expect(response).to.deep.equal({
        status: 'ok',
        history: []
      });
      done();
    });
  });

  it('should handle authentication when `option.auth` is AUTH_USER', function (done) {
    stream = bunyanRemote({
      auth: bunyanRemote.AUTH_USER,
      authenticate: 'jdoe:pass123'
    });

    socket = io.connect('http://localhost:3232');
    socket.on('info', function (info) {
      expect(info.auth).to.equal(bunyanRemote.AUTH_USER);
      socket.emit('auth', {
        user: 'jdoe',
        password: 'pass123'
      });
    });
    socket.on('auth', function (response) {
      expect(response).to.deep.equal({
        status: 'ok',
        history: []
      });
      done();
    });
  });

  it('should emit a "log" event to clients on `write` ', function (done) {
    stream = bunyanRemote();

    socket = io.connect('http://localhost:3232');
    socket.on('info', function () { socket.emit('auth'); });

    socket.on('auth', function () {
      stream.stream.write({ msg: 'This is a test' });
    });

    socket.on('log', function (record) {
      expect(record).to.deep.equal({
        msg: 'This is a test'
      });
      done();
    });
  });

  it('should attach to a custom http.Server instance', function (done) {
    var server = http.Server();
    stream = bunyanRemote();

    stream.attach(server);
    server.listen(4242);

    socket = io.connect('http://localhost:4242');
    socket.on('connect', function () {
      done();
    });

  });

});