var BunyanLogger = {};

(function () {
  var moment = null;
  BunyanLogger.TIME_UTC = 1;
  BunyanLogger.OM_LONG = 1;
  BunyanLogger.OM_JSON = 2;
  BunyanLogger.OM_INSPECT = 3;
  BunyanLogger.OM_SIMPLE = 4;
  BunyanLogger.OM_SHORT = 5;
  BunyanLogger.OM_BUNYAN = 6;
  BunyanLogger.OM_FROM_NAME = {
      'long': BunyanLogger.OM_LONG,
      'paul': BunyanLogger.OM_LONG,  /* backward compat */
      'json': BunyanLogger.OM_JSON,
      'inspect': BunyanLogger.OM_INSPECT,
      'simple': BunyanLogger.OM_SIMPLE,
      'short': BunyanLogger.OM_SHORT,
      'bunyan': BunyanLogger.OM_BUNYAN
  };

  // Levels
  var TRACE = 10;
  var DEBUG = 20;
  var INFO = 30;
  var WARN = 40;
  var ERROR = 50;
  var FATAL = 60;

  var levelFromName = {
      'trace': TRACE,
      'debug': DEBUG,
      'info': INFO,
      'warn': WARN,
      'error': ERROR,
      'fatal': FATAL
  };

  var nameFromLevel = {};
  var upperNameFromLevel = {};
  var upperPaddedNameFromLevel = {};
  Object.keys(levelFromName).forEach(function (name) {
      var lvl = levelFromName[name];
      nameFromLevel[lvl] = name;
      upperNameFromLevel[lvl] = name.toUpperCase();
      upperPaddedNameFromLevel[lvl] = (
          name.length === 4 ? ' ' : '') + name.toUpperCase();
  });

  var inspect = JSON.stringify;
  var formatRegExp = /%[sdj%]/g;
  function format(f) {
      if (typeof f !== 'string') {
          var objects = [];
          for (var i = 0; i < arguments.length; i++) {
              objects.push(inspect(arguments[i]));
          }
          return objects.join(' ');
      }

      var i = 1;
      var args = arguments;
      var len = args.length;
      var str = String(f).replace(formatRegExp, function (x) {
          if (i >= len)
              return x;
          switch (x) {
              case '%s': return String(args[i++]);
              case '%d': return Number(args[i++]);
              case '%j': return JSON.stringify(args[i++]);
              case '%%': return '%';
              default:
                  return x;
          }
      });
      for (var x = args[i]; i < len; x = args[++i]) {
          if (x === null || typeof x !== 'object') {
              str += ' ' + x;
          } else {
              str += ' ' + inspect(x);
          }
      }
      return str;
  };

  function isValidRecord(rec) {
      if (rec.v == null ||
              rec.level == null ||
              rec.name == null ||
              rec.hostname == null ||
              rec.pid == null ||
              rec.time == null ||
              rec.msg == null) {
          // Not valid Bunyan log.
          return false;
      } else {
          return true;
      }
  }

  function indent(s) {
      return '    ' + s.split(/\r?\n/).join('\n    ');
  }

  BunyanLogger.emitRecord = function (rec, line, opts, stylize) {
      var short = false;
      rec = JSON.parse(JSON.stringify(rec));

      switch (opts.outputMode) {
      case BunyanLogger.OM_SHORT:
          short = true;
          /* jsl:fall-thru */

      case BunyanLogger.OM_LONG:
          //    [time] LEVEL: name[/comp]/pid on hostname (src): msg* (extras...)
          //        msg*
          //        --
          //        long and multi-line extras
          //        ...
          // If 'msg' is single-line, then it goes in the top line.
          // If 'req', show the request.
          // If 'res', show the response.
          // If 'err' and 'err.stack' then show that.
          if (!isValidRecord(rec)) {
              return opts.emit(line + '\n', rec);
          }

          delete rec.v;

          // Time.
          var time;
          if (!short && opts.timeFormat === BunyanLogger.TIME_UTC) {
              // Fast default path: We assume the raw `rec.time` is a UTC time
              // in ISO 8601 format (per spec).
              time = '[' + rec.time + ']';
          } else if (!moment && opts.timeFormat === BunyanLogger.TIME_UTC) {
              // Don't require momentjs install, as long as not using TIME_LOCAL.
              time = rec.time.substr(11);
          } else {
              var tzFormat;
              var moTime = moment(rec.time);
              switch (opts.timeFormat) {
              case BunyanLogger.TIME_UTC:
                  tzFormat = TIMEZONE_UTC_FORMATS[short ? 'short' : 'long'];
                  moTime.utc();
                  break;
              case TIME_LOCAL:
                  tzFormat = TIMEZONE_LOCAL_FORMATS[short ? 'short' : 'long'];
                  break;
              default:
                  throw new Error('unexpected timeFormat: ' + opts.timeFormat);
              };
              time = moTime.format(tzFormat);
          }
          time = stylize(time, 'XXX');
          delete rec.time;

          var nameStr = rec.name;
          delete rec.name;

          if (rec.component) {
              nameStr += '/' + rec.component;
          }
          delete rec.component;

          if (!short)
              nameStr += '/' + rec.pid;
          delete rec.pid;

          var level = (upperPaddedNameFromLevel[rec.level] || 'LVL' + rec.level);
          if (opts.color) {
              var colorFromLevel = {
                  10: '#999999',    // TRACE
                  20: '#F4BF00',   // DEBUG
                  30: '#1ABEE3',     // INFO
                  40: '#E31ACB',  // WARN
                  50: '#FF0000',      // ERROR
                  60: 'white/#FF0000',  // FATAL
              };
              level = stylize(level, colorFromLevel[rec.level]);
          }
          delete rec.level;

          var src = '';
          if (rec.src && rec.src.file) {
              var s = rec.src;
              if (s.func) {
                  src = format(' (%s:%d in %s)', s.file, s.line, s.func);
              } else {
                  src = format(' (%s:%d)', s.file, s.line);
              }
              src = stylize(src, 'green');
          }
          delete rec.src;

          var hostname = rec.hostname;
          delete rec.hostname;

          var extras = [];
          var details = [];

          if (rec.req_id) {
              extras.push('req_id=' + rec.req_id);
          }
          delete rec.req_id;

          var onelineMsg;
          if (rec.msg.indexOf('\n') !== -1) {
              onelineMsg = '';
              details.push(indent(stylize(rec.msg, '#1ABEE3')));
          } else {
              onelineMsg = ' ' + stylize(rec.msg, '#1ABEE3');
          }
          delete rec.msg;

          if (rec.req && typeof (rec.req) === 'object') {
              var req = rec.req;
              delete rec.req;
              var headers = req.headers;
              if (!headers) {
                  headers = '';
              } else if (typeof (headers) === 'string') {
                  headers = '\n' + headers;
              } else if (typeof (headers) === 'object') {
                  headers = '\n' + Object.keys(headers).map(function (h) {
                      return h + ': ' + headers[h];
                  }).join('\n');
              }
              var s = format('%s %s HTTP/%s%s', req.method,
                  req.url,
                  req.httpVersion || '1.1',
                  headers
              );
              delete req.url;
              delete req.method;
              delete req.httpVersion;
              delete req.headers;
              if (req.body) {
                  s += '\n\n' + (typeof (req.body) === 'object'
                      ? JSON.stringify(req.body, null, 2) : req.body);
                  delete req.body;
              }
              if (req.trailers && Object.keys(req.trailers) > 0) {
                  s += '\n' + Object.keys(req.trailers).map(function (t) {
                      return t + ': ' + req.trailers[t];
                  }).join('\n');
              }
              delete req.trailers;
              details.push(indent(s));
              // E.g. for extra 'foo' field on 'req', add 'req.foo' at
              // top-level. This *does* have the potential to stomp on a
              // literal 'req.foo' key.
              Object.keys(req).forEach(function (k) {
                  rec['req.' + k] = req[k];
              })
          }

          if (rec.client_req && typeof (rec.client_req) === 'object') {
              var client_req = rec.client_req;
              delete rec.client_req;
              var headers = client_req.headers;
              var hostHeaderLine = '';
              var s = '';
              if (client_req.address) {
                  hostHeaderLine = '\nHost: ' + client_req.address;
                  if (client_req.port)
                      hostHeaderLine += ':' + client_req.port;
              }
              delete client_req.headers;
              delete client_req.address;
              delete client_req.port;
              s += format('%s %s HTTP/%s%s%s', client_req.method,
                  client_req.url,
                  client_req.httpVersion || '1.1',
                  hostHeaderLine,
                  (headers ?
                      '\n' + Object.keys(headers).map(
                          function (h) {
                              return h + ': ' + headers[h];
                          }).join('\n') :
                      ''));
              delete client_req.method;
              delete client_req.url;
              delete client_req.httpVersion;
              if (client_req.body) {
                  s += '\n\n' + (typeof (client_req.body) === 'object' ?
                      JSON.stringify(client_req.body, null, 2) :
                      client_req.body);
                  delete client_req.body;
              }
              // E.g. for extra 'foo' field on 'client_req', add
              // 'client_req.foo' at top-level. This *does* have the potential
              // to stomp on a literal 'client_req.foo' key.
              Object.keys(client_req).forEach(function (k) {
                  rec['client_req.' + k] = client_req[k];
              })
              details.push(indent(s));
          }

          function _res(res) {
              var s = '';
              if (res.statusCode !== undefined) {
                  s += format('HTTP/1.1 %s %s\n', res.statusCode,
                      http.STATUS_CODES[res.statusCode]);
                  delete res.statusCode;
              }
              // Handle `res.header` or `res.headers` as either a string or
              // and object of header key/value pairs. Prefer `res.header` if set
              // (TODO: Why? I don't recall. Typical of restify serializer?
              // Typical JSON.stringify of a core node HttpResponse?)
              var headerTypes = {string: true, object: true};
              var headers;
              if (res.header && headerTypes[typeof (res.header)]) {
                  headers = res.header;
                  delete res.header;
              } else if (res.headers && headerTypes[typeof (res.headers)]) {
                  headers = res.headers;
                  delete res.headers;
              }
              if (headers === undefined) {
                  /* pass through */
              } else if (typeof (headers) === 'string') {
                  s += headers.trimRight();
              } else {
                  s += Object.keys(headers).map(
                      function (h) { return h + ': ' + headers[h]; }).join('\n');
              }
              if (res.body !== undefined) {
                  var body = (typeof (res.body) === 'object'
                      ? JSON.stringify(res.body, null, 2) : res.body);
                  if (body.length > 0) { s += '\n\n' + body };
                  delete res.body;
              } else {
                  s = s.trimRight();
              }
              if (res.trailer) {
                  s += '\n' + res.trailer;
              }
              delete res.trailer;
              if (s) {
                  details.push(indent(s));
              }
              // E.g. for extra 'foo' field on 'res', add 'res.foo' at
              // top-level. This *does* have the potential to stomp on a
              // literal 'res.foo' key.
              Object.keys(res).forEach(function (k) {
                  rec['res.' + k] = res[k];
              });
          }

          if (rec.res && typeof (rec.res) === 'object') {
              _res(rec.res);
              delete rec.res;
          }
          if (rec.client_res && typeof (rec.client_res) === 'object') {
              _res(rec.client_res);
              delete rec.client_res;
          }

          if (rec.err && rec.err.stack) {
              var err = rec.err
              if (typeof (err.stack) !== 'string') {
                  details.push('<pre>' + indent(err.stack.toString()) + '</pre>');
              } else {
                  details.push('<pre>' + indent(err.stack) + '</pre>');
              }
              delete err.message;
              delete err.name;
              delete err.stack;
              // E.g. for extra 'foo' field on 'err', add 'err.foo' at
              // top-level. This *does* have the potential to stomp on a
              // literal 'err.foo' key.
              Object.keys(err).forEach(function (k) {
                  rec['err.' + k] = err[k];
              })
              delete rec.err;
          }

          // var leftover = Object.keys(rec);
          // for (var i = 0; i < leftover.length; i++) {
          //     var key = leftover[i];
          //     var value = rec[key];
          //     var stringified = false;
          //     if (typeof (value) !== 'string') {
          //         value = JSON.stringify(value, null, 2);
          //         stringified = true;
          //     }
          //     if (value.indexOf('\n') !== -1 || value.length > 50) {
          //         details.push(indent(key + ': ' + value));
          //     } else if (!stringified && (value.indexOf(' ') != -1 ||
          //         value.length === 0))
          //     {
          //         extras.push(key + '=' + JSON.stringify(value));
          //     } else {
          //         extras.push(key + '=' + value);
          //     }
          // }
          details = stylize(
              (details.length ? details.join('\n    --\n') + '\n' : ''), 'XXX');
          if (!short)
              opts.emit(format('%s %s: %s on %s%s:%s%s\n%s',
                  time,
                  level,
                  nameStr,
                  hostname || '<no-hostname>',
                  src,
                  onelineMsg,
                  extras,
                  details), rec);
          else
              opts.emit(format('%s %s %s:%s%s\n%s',
                  time,
                  level,
                  nameStr,
                  onelineMsg,
                  extras,
                  details), rec);
          break;

      case BunyanLogger.OM_INSPECT:
          opts.emit(util.inspect(rec, false, Infinity, true) + '\n', rec);
          break;

      case BunyanLogger.OM_BUNYAN:
          opts.emit(JSON.stringify(rec, null, 0) + '\n', rec);
          break;

      case BunyanLogger.OM_JSON:
          opts.emit(JSON.stringify(rec, null, opts.jsonIndent) + '\n', rec);
          break;

      case BunyanLogger.OM_SIMPLE:
          /* JSSTYLED */
          // <http://logging.apache.org/log4j/1.2/apidocs/org/apache/log4j/SimpleLayout.html>
          if (!isValidRecord(rec)) {
              return opts.emit(line + '\n', rec);
          }
          opts.emit(format('%s - %s\n',
              upperNameFromLevel[rec.level] || 'LVL' + rec.level,
              rec.msg), rec);
          break;
      default:
          throw new Error('unknown output mode: '+opts.outputMode);
      }
  }
})();