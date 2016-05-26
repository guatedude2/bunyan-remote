/* global chrome document $ io EventEmitter BunyanLogger */
(function() {
  var VERSION_MIN = '0.0.1';
  var VERSION_MAX = '0.1.0';
  var PORT = 3232;

  var AUTH_NONE = 0;
  var AUTH_KEY = 1;
  var AUTH_USER = 2;

  var STATUS_DISCONNECTED = 0;
  var STATUS_READY = 1;
  var STATUS_AUTHENTICATING = 2;
  var STATUS_CONNECTED = 3;

  var ALL = 0;
  var TRACE = 1;
  var DEBUG = 2;
  var INFO = 4;
  var WARN = 8;
  var ERROR = 16;

  var FLAGS = [ALL, ERROR, WARN, INFO, DEBUG, TRACE];

  var LEVELS = {
    0: ALL,
    10: TRACE,
    20: DEBUG,
    30: INFO,
    40: WARN,
    50: ERROR
  };

  var comm = new EventEmitter();

  var logEl = $('#log')[0];
  comm.autoConnect = true;
  comm.maxLogLevel = ALL;
  comm.logFilter = null;
  comm.reconnectDelay = 3000;
  comm.hostname = '';
  comm.dispatch = comm.emit;
  comm.emit = function (event, data) {
    if (comm.socket) {
      comm.socket.emit(event, data);
    }
  };
  comm.connect = function () {
    if (comm.socket) {
      comm.socket.connect();
    }
  };
  comm.disconnect = function () {
    if (comm.socket) {
      comm.socket.disconnect();
    }
  };

  function isVisible(rec) {
    var level = LEVELS[rec.level] || 0;
    var match = comm.logFilter ? Object.keys(comm.logFilter).reduce(function (result, key) {
      return (!result && rec[key] !== undefined ? rec[key] === comm.logFilter[key] : result);
    }, false) : true;
    return (comm.maxLogLevel === ALL || (level & comm.maxLogLevel) === level) && match;
  }

  function versionValid(current, max, min) {
    current = current.split('.').reduce(function(r, v, i) { return r + (v * Math.pow(1000, 2 - i)); }, 0);
    min = min.split('.').reduce(function(r, v, i) { return r + (v * Math.pow(1000, 2 - i)); }, 0);
    max = max.split('.').reduce(function(r, v, i) { return r + (v * Math.pow(1000, 2 - i)); }, 0);
    return !isNaN(current) && current >= min && current <= max;
  }

  function checkTabUrl() {
    chrome.devtools.inspectedWindow.eval('location.hostname', function (hostname) {
      if (hostname !== comm.hostname) {
        comm.hostname = hostname;
        $(logEl).html('');
        if (comm.socket) {
          comm.socket.disconnect();
        }
        comm.authMode = AUTH_NONE;
        comm.status = STATUS_DISCONNECTED;
        comm.socket = io.connect($.format('http://%s:%s', hostname, PORT));
        comm.socket.on('info', function (data) { comm.dispatch('info', data); });
        comm.socket.on('auth', function (data) { comm.dispatch('auth', data); });
        comm.socket.on('log', function (data) { comm.dispatch('log', data); });
        comm.socket.on('disconnect', function (data) { comm.dispatch('disconnect', data); });
      }
    });
    setTimeout(checkTabUrl, 1000);
  }

  /* communications */

  comm.authMode = AUTH_NONE;
  comm.status = STATUS_DISCONNECTED;
  comm.on('info', function(info){
    if (!versionValid(info.version, VERSION_MIN, VERSION_MAX)) {
      $('.status-text')
        .addClass('error')
        .html($.format('Incompatible server version %s', info.version));
      return;
    }
    $('.status-text')
      .removeClass('not-found')
      .removeClass('error')
      .html('Bunyan server found');

    comm.serverHostname = info.hostname;
    comm.authMode = info.auth;
    comm.status = STATUS_READY;
    $('#connect-disconnect').removeAttr('disabled');

    // auto connect
    if (comm.autoConnect) {
      $('#connect-disconnect').trigger('click');
    }
  });

  comm.on('auth', function (result) {
    if (result.status === 'ok') {
      $('.auth-panel').removeClass('shown');
      $('.status-text').html($.format('Connected to %s', comm.serverHostname));
      $('#connect-disconnect').addClass('active');
      comm.status = STATUS_CONNECTED;
      result.history.forEach(function (rec) {
        comm.dispatch('log', rec);
      });
    } else {
      comm.autoConnect = false;
      $('.status-text')
        .addClass('error')
        .html('Error: ' + result.error || 'Unknown server error');
    }
  });

  comm.on('log', function(rec){
    var stickyScroll = false;
    if (logEl.scrollTop > (logEl.scrollHeight - logEl.clientHeight - 5)) {
      stickyScroll = true;
    }

    BunyanLogger.emitRecord(rec, 0, {
      color: true,
      outputMode: BunyanLogger.OM_LONG,
      timeFormat: BunyanLogger.TIME_UTC,
      emit: function (html, extra) {
        var wrapper = document.createElement('div');
        var filterCount = Object.keys(extra).length;
        $(wrapper)
          .addClass('console-message-wrapper')
          .addClass('console-log-level');

        if (filterCount > 0) {
          var extraHtml = Object.keys(extra).map(function (k) {
            return $.format('<li><span class="key">%s</span>=<span class="value" data-filter="%s=%s">%s</span></li>', k, k, extra[k], extra[k]);
          }).join('');

          html += $.format('<a class="extra-filter">filters (%s)</a><div class="extra-expander"><ol>%s</ol></div></div>', filterCount, extraHtml);
        }

        $(wrapper).html(html);
        $(wrapper).css('display', isVisible(rec) ? 'block' : 'none');
        $('a.extra-filter', wrapper).on('click', function () {
          $('div.extra-expander', wrapper).toggleClass('shown');
          return false;
        });
        $('span.value', wrapper).on('click', function (){
          $('div.extra-expander', wrapper).removeClass('shown');
          $('#filter-input-field').val($(this).attr('data-filter'));
          $('#filter-input-field').trigger('change');
        });
        wrapper.rec = rec;
        logEl.appendChild(wrapper);
      }
    }, function (str, color) {
      color = color.split('/');
      var fg = color[0] === 'XXX' ? 'gray' : color[0];
      return $.format('<span style="color: %s;">%s</span>', fg, str);
    });

    if (stickyScroll) {
      logEl.scrollTop = logEl.scrollHeight;
    }
  });


  comm.on('disconnect', function(){
    if (!$('.status-text').hasClass('error')) {
      $('.status-text')
        .addClass('not-found')
        .html('Bunyan server not found');
    }
    $('.auth-panel').removeClass('shown');
    $('#connect-disconnect')
      .removeClass('active')
      .attr('disabled', 'disabled');
    comm.status = STATUS_DISCONNECTED;
    setTimeout(function () {
      comm.connect();
      comm.reconnectDelay = 3000;
    }, comm.reconnectDelay);
  });

  /* events */

  // toolbar filter buttons
  $('.filter-bitset li').on('click', function (event, index) {
    if (!event.metaKey || $(this).hasClass('all')) {
      $('.filter-bitset li').removeClass('selected');
      comm.maxLogLevel = FLAGS[index];
      $(this).addClass('selected');
    } else {
      $('.filter-bitset li.all').removeClass('selected');
      if ($(this).hasClass('selected')) {
        comm.maxLogLevel &= ~FLAGS[index];
      } else {
        comm.maxLogLevel |= FLAGS[index];
      }
      $(this).toggleClass('selected');
    }

    $('#log > div').forEach(function (el) {
      $(el).css('display', isVisible(el.rec) ? 'block' : 'none');
    });
    logEl.scrollTop = logEl.scrollHeight;
  });

  // toolbar filter textbox
  $('#filter-input-field').on('change', function () {
    var value = $(this).val();
    comm.logFilter = value ? value.split(/\s*,\s*/).reduce(function (result, param) {
      var parts = param.split('=');
      if (parts[1] !== undefined) {
        result[parts.shift()] = parts.join('=');
      }
      return result;
    }, {}) : null;

    $('#log > div').forEach(function (el) {
      $(el).css('display', isVisible(el.rec) ? 'block' : 'none');
    });
  }).on('keyup', $.debounce(function () {
    $(this).trigger('change');
  }), 250);

  // toolbar connect/disconnect button
  $('#connect-disconnect').on('click', function () {
    if (comm.status === STATUS_READY) {
      $(this).addClass('active');

      if (comm.authMode === AUTH_NONE) {
        comm.emit('auth');
      } else if (comm.authMode === AUTH_KEY) {
        $('.status-text').html($.format('Authentication required...'));
        $('.auth-panel .text').html('Enter the server key:');
        $('#auth-input-key-user').attr('placeholder', 'Server Key');
        $('#auth-input-pass').css('display', 'none');
        $('.auth-panel').addClass('shown');
      } else if (comm.authMode === AUTH_USER) {
        $('.status-text').html($.format('Authentication required...'));
        $('.auth-panel .text').html('Enter your username and password:');
        $('#auth-input-key-user').attr('placeholder', 'Username');
        $('#auth-input-pass').css('display', 'inherit');
        $('.auth-panel').addClass('shown');
      }

      comm.status = STATUS_AUTHENTICATING;
      comm.autoConnect = true;

    } else {
      $('.auth-panel').removeClass('shown');
      $(this).removeClass('active');
      comm.reconnectDelay = 1000;
      comm.autoConnect = false;
      comm.disconnect();
      $('.status-text').html('Disconnecting...');
    }
  });

  // auth panel events
  $('.auth-panel button.validate').on('click', function () {
    if (comm.authMode == AUTH_USER) {
      $('.status-text').html('Validating credentials...');
      comm.emit('auth', {
        user: $('#auth-input-key-user').val(),
        password: $('#auth-input-pass').val()
      });
    } else {
      $('.status-text').html('Validating server key...');
      comm.emit('auth', $('#auth-input-key-user').val());
    }
    $('.auth-panel').removeClass('shown');
  });

  $('.auth-panel button.cancel').on('click', function () {
    $('.status-text')
      .removeClass('error')
      .html('Bunyan server found');
    $('.auth-panel').removeClass('shown');
    $('#connect-disconnect').removeClass('active');
    comm.status = STATUS_READY;
    comm.autoConnect = false;
  });

  $('.auth-panel').on('keypress', function (event) {
    if (event.keyCode === 13) {
      $('.auth-panel button').trigger('click');
    }
  });

  if (!chrome.devtools) {
    chrome.devtools = {
      inspectedWindow: {
        eval: function (expr, cb) { cb('localhost'); }
      }
    };
  }

  /* init tab hooks */
  checkTabUrl();

})();


