/*
  Based on youmightnotneedjquery.com
  Author: Alejandro Gonzalez Sole
 */

/* global document window getComputedStyle */

(function (window) {
  var yQuery = function (query, target) {
    var obj = [query];
    if (typeof query === 'string') {
      obj = Array.prototype.slice.call((target || document).querySelectorAll(query));
    }

    /* common functions */
    obj.find = function (query) {
      return yQuery(query, this);
    };

    obj.on = function (event, callback) {
      this.forEach(function (el, index) {
        el.addEventListener(event, function (event) { callback.call(el, event, index); });
      });
      return this;
    };

    obj.trigger = function (event, data) {
      this.forEach(function (el) {
        var evt = document.createEvent('HTMLEvents');
        evt.initEvent(event, true, true, data);
        el.dispatchEvent(evt);
      });
    };

    obj.focus = function () {
      this.forEach(function (el) {
        console.log(el)
        el.focus();
      });
      return this;
    };

    obj.html = function (val) {
      return this.reduce(function (result, el) {
        return result += (val !== undefined) ? (el.innerHTML = val) : el.innerHTML;
      }, '');
    };

    obj.val = function (val) {
      return this.reduce(function (result, el) {
        return result += (val !== undefined && (el.value = val)) || el.value;
      }, '');
    };

    /* attribute manipulation */
    obj.attr = function (name, val) {
      return this.reduce(function (result, el) {
        return result += (val !== undefined && el.setAttribute(name, val)) || el.getAttribute(name);
      }, '');
    };
    obj.removeAttr = function (name) {
      this.forEach(function (el) {
        el.removeAttribute(name);
      });
      return this;
    };

    /* css style manipulation */
    obj.css = function (name, style) {
      var ruleName = yQuery.camelCase(name);
      return this.reduce(function (result, el) {
        return result += (style !== undefined && (el.style[ruleName] = style)) || getComputedStyle(el)[ruleName];
      }, '');
    };

    /* class manipulation */
    obj.hasClass = function (className) {
      return this.reduce(function (result, el) {
        return result ? el.classList.contains(className) : false;
      }, true);
    };
    obj.addClass = function (className) {
      this.forEach(function (el) {
        el.classList.add(className);
      });
      return this;
    };
    obj.removeClass = function (className) {
      this.forEach(function (el) {
        el.classList.remove(className);
      });
      return this;
    };
    obj.toggleClass = function (className) {
      this.hasClass(className) ? this.removeClass(className) : this.addClass(className);
      return this;
    };
    return obj;
  };

  yQuery.format = function (strFrmt) {
    var args = Array.prototype.slice.call(arguments, 1);
    return strFrmt.replace(/(?!\\)%s/g, function () {
      if (args.length > 0) {
        return args.shift();
      } else {
        return '';
      }
    });
  };

  yQuery.camelCase = function (str) {
    return ('' + str).toLowerCase().replace(/\-([a-z])/gi, function (dummy, first) {
      return first.toUpperCase();
    });
  };

  yQuery.debounce = function (callback, delay) {
    return function (event) {
      clearTimeout(callback._debounceId);
      callback._debounceId = setTimeout(callback.bind(this, event), delay || 0);
    };
  };

  window.$ = yQuery;
})(window);