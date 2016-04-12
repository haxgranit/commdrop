import Ember from 'ember';
import CoughDrop from '../app';
import stashes from './_stashes';
import capabilities from './capabilities';

(function() {
  var console_debug = function(str) {
    if(console.debug) {
      console.debug(str);
    } else {
      console.log(str);
    }
  };

  var extras = Ember.Object.extend({
    setup: function(container, application) {
      application.register('cough_drop:extras', extras, { instantiate: false, singleton: true });
      Ember.$.each(['model', 'controller', 'view', 'route'], function(i, component) {
        application.inject(component, 'extras', 'cough_drop:extras');
      });
    },
    enable: function() {
      if(this.get('ready')) { return; }

      console_debug("COUGHDROP: extras ready");
      if(window.app_version) {
        console_debug("COUGHDROP: app version " + window.app_version);
      }
      this.set('ready', true);
      if(window.speechSynthesis) {
        console_debug("COUGHDROP: tts enabled");
      }
//      this.eye_gaze({enable: true});
      if(!CoughDrop.app) {
        window.cough_drop_readiness = true;
      } else {
        CoughDrop.app.advanceReadiness();
      }
    },
    logout: function() {
      if(capabilities.host) {
        capabilities.invoke({type: 'coughDropExtras', method: 'logout'});
        return true;
      } else {
        return false;
      }
    },
    eye_gaze: function(options) {
      capabilities.invoke({type: 'coughDropExtras', method: 'eye_gaze', options: {enable: true}});
    },
    storage: {
      defers: {},
      find: function(store, key) {
        var defer = Ember.RSVP.defer();
        defer.method = 'storage.find';
        defer.store = store;
        defer.key = key;
        var defer_key = "defer_" + (new Date()).getTime().toString() + "_" + Math.random().toString();
        extras.storage.defers[defer_key] = defer;
        capabilities.invoke({type: 'coughDropExtras', method: 'storage_find', options: {id: defer_key, store: store, key: key}});
        return defer.promise;
      },
      find_all: function(store) {
        var defer = Ember.RSVP.defer();
        defer.method = 'storage.find_all';
        defer.store = store;
        var defer_key = "defer_" + (new Date()).getTime().toString() + "_" + Math.random().toString();
        extras.storage.defers[defer_key] = defer;
        capabilities.invoke({type: 'coughDropExtras', method: 'storage_find_all', options: {id: defer_key, store: store}});
        return defer.promise;
      },
      find_changed: function() {
        var defer = Ember.RSVP.defer();
        defer.method = 'storage.find_changed';
        var defer_key = "defer_" + (new Date()).getTime().toString() + "_" + Math.random().toString();
        extras.storage.defers[defer_key] = defer;
        capabilities.invoke({type: 'coughDropExtras', method: 'storage_find_changed', options: {id: defer_key}});
        return defer.promise;
      },
      store: function(store, obj, key) {
        var defer = Ember.RSVP.defer();
        defer.method = 'storage.store';
        defer.store = store;
        defer.key = key;
        var defer_key = "defer_" + (new Date()).getTime().toString() + "_" + Math.random().toString();
        extras.storage.defers[defer_key] = defer;
        capabilities.invoke({type: 'coughDropExtras', method: 'storage_store', options: {id: defer_key, store: store, record: obj}});
        return defer.promise;
      },
      remove: function(store, id) {
        var defer = Ember.RSVP.defer();
        defer.method = 'storage.remove';
        defer.store = store;
        defer.key = id;
        var defer_key = "defer_" + (new Date()).getTime().toString() + "_" + Math.random().toString();
        extras.storage.defers[defer_key] = defer;
        capabilities.invoke({type: 'coughDropExtras', method: 'storage_remove', options: {id: defer_key, store: store, record_id: id}});
        return defer.promise;
      }
    },
    extension_message: function(message) {
      if(message.type == 'coughDropExtras' && message.ready) {
        extras.enable();
      } else if(message.type == 'share') {
        if(message.result_type == 'not_supported') {
          extras.share.default_load(message.options);
        }
      } else if(message.type == 'eye_gaze_event') {
        if(message.event_type == 'tracker') {
          extras.set('eye_gaze_state', message.track_type);
        } else if(message.event_type == 'tracker_disabled') {
          extras.set('eye_gaze_state', null);
        }
        console.log(message);
      } else if(message.type == 'storage_result') {
        var defer = extras.storage.defers[message.id];
        if(defer) {
          delete extras.storage.defers[message.id];
          if(message.result_type == 'success') {
            Ember.run(function() {
              defer.resolve(message.result);
            });
          } else {
            Ember.run(function() {
              var res = message.result;
              if(defer.method) {
                res.defer_method = defer.method;
              }
              if(defer.store) {
                res.defer_store = defer.store;
              }
              if(defer.key) {
                res.defer_key = defer.key;
              }
              defer.reject(res);
            });
          }
        }
      } else if(message.type == 'ajax_result') {
        var defer = extras.ajax.defers[message.id];
        if(defer) {
          delete extras.ajax.defers[message.id];
          if(message.result_type == 'success') {
            Ember.run(function() {
              defer.resolve(message.result[0]);
            });
          } else {
            Ember.run(function() {
              defer.reject(message.result[0]);
            });
          }
        }
      }
    },
    track_error: function(message) {
      if(window.trackJs) {
        window.trackJs.track(message);
      }
    }
  }).create();
  var device_id = stashes.get_raw('coughDropDeviceId');
  if(!device_id) {
    device_id = ((new Date()).getTime() + Math.random()).toString();
    var readable = capabilities.readable_device_name;
    device_id = device_id + " " + readable;
  }
  stashes.persist_raw('coughDropDeviceId', device_id);
  capabilities.device_id = device_id;

  Ember.$.realAjax = Ember.$.ajax;
  function fakeXHR(xhr) {
    var res = {status: 0};
    if(xhr && xhr.status) {
      var res = {
        readyState: xhr.readyState,
        responseJSON: xhr.responseJSON,
        responseText: xhr.responseText,
        status: xhr.status,
        statusText: xhr.statusText,
      };
      if(xhr.getResponseHeader && xhr.getResponseHeader('BROWSER_TOKEN')) {
        res.browserToken = xhr.getResponseHeader('BROWSER_TOKEN');
      }
    }
    res.getAllResponseHeaders = function() { return null; };
    return res;
  }

  Ember.$.ajax = function(opts) {
    var _this = this;
    var args = [];
    var options = arguments[0];
    var clean_options = {};
    if(typeof(arguments[0]) == 'string') {
      options = arguments[1];
      options.url = options.url || arguments[0];
    }
    if(options.url && options.url.match(/\/api\/v\d+\/boards\/.+%2F.+/)) {
      options.url = options.url.replace(/%2F/, '/');
    }
    ['async', 'cache', 'contentType', 'context', 'crossDomain', 'data', 'dataType', 'error', 'global', 'headers', 'ifModified', 'isLocal', 'mimeType', 'processData', 'success', 'timeout', 'type', 'url'].forEach(function(key) {
      if(options[key]) {
        clean_options[key] = options[key];
      }
    });
    args.push(clean_options);

    return Ember.RSVP.resolve().then(function() {
      var prefix = location.protocol + "//" + location.host;
      if(capabilities.installed_app && capabilities.api_host) {
        prefix = capabilities.api_host;
      }
      if(options.url && options.url.indexOf(prefix) === 0) {
        options.url = options.url.substring(prefix.length);
      }
      if(options.url && options.url.match(/^\//)) {
        if(options.url && options.url.match(/^\/(api\/v\d+\/|token)/) && capabilities.installed_app && capabilities.api_host) {
          options.url = capabilities.api_host + options.url;
        }
        if(capabilities.access_token) {
          options.headers = options.headers || {};
          options.headers['Authorization'] = "Bearer " + capabilities.access_token;
          options.headers['X-Device-Id'] = device_id;
          options.headers['X-CoughDrop-Version'] = window.CoughDrop.VERSION;
        }
        if(CoughDrop.session && CoughDrop.session.get('as_user_id')) {
          options.headers = options.headers || {};
          options.headers['X-As-User-Id'] = CoughDrop.session.get('as_user_id');
        }
        if(window.ApplicationCache) {
          options.headers = options.headers || {};
          options.headers['X-Has-AppCache'] = "true";
        }
      }

      var success = options.success;
      var error = options.error;
      options.success = null;
      options.error = null;
      var res = Ember.$.realAjax(options).then(function(data, message, xhr) {
        if(typeof(data) == 'string') {
          data = {text: data};
        }
        if(data && data.error && data.status && !data.ok) {
          console.log("ember ajax error: " + data.status + ": " + data.error + " (" + options.url + ")");
          if(error) {
            error.call(this, xhr, message, data);
            // The bowels of ember aren't expecting Ember.$.ajax to return a real
            // promise and so they don't catch the rejection properly, which
            // potentially causes all sorts of unexpected uncaught errors.
            // NOTE: this means that any CoughDrop code should not use the error parameter
            // if it expects to receive a proper promise.
            // TODO: raise an error somehow if the caller provides an error function
            // and expects a proper promise in response.
            return Ember.RSVP.resolve(null);
          } else {
            return Ember.RSVP.reject({
              stack: data.status + ": " + data.error + " (" + options.url + ")",
              fakeXHR: fakeXHR(xhr),
              message: message,
              result: data
            });
           }
        } else {
          if(typeof(data) == 'string') {
          }
          if(data === '' || data === undefined || data === null) {
            data = {};
          }
          data.meta = (data.meta || {});
          data.meta.fakeXHR = fakeXHR(xhr);
          delete data.meta.fakeXHR['responseJSON'];
          Ember.$.ajax.meta_push({url: options.url, method: options.type, meta: data.meta});
          if(success) {
            success.call(this, data, message, xhr);
          }
          return data;
        }
      }, function(xhr, message, result) {
        if(xhr.responseJSON && xhr.responseJSON.error) {
          result = xhr.responseJSON.error;
        }
        console.log("ember ajax error: " + xhr.status + ": " + result + " (" + options.url + ")");
        if(error) {
          error.call(this, xhr, message, result);
        }
        return Ember.RSVP.reject({
          fakeXHR: fakeXHR(xhr),
          message: message,
          result: result
        });
      });
      res.then(null, function() { });
      return res;
    });
  };
  Ember.$.ajax.metas = [];
  Ember.$.ajax.meta_push = function(opts) {
    var now = (new Date()).getTime();
    opts.ts = now;

    var metas = Ember.$.ajax.metas || [];
    var new_list = [];
    var res = null;
    metas.forEach(function(meta) {
      if(!meta.ts || meta.ts < now - 1000) {
        new_list.push(meta);
      }
    });
    new_list.push(opts);
    Ember.$.ajax.metas = new_list;
  };
  Ember.$.ajax.meta = function(method, store, id) {
    var res = null;
    var metas = Ember.$.ajax.metas || [];
    // TODO: pluralize correctly using same ember library
    var url = "/api/v1/" + store + "s";
    if(capabilities.installed_app && capabilities.api_host) {
      url = capabilities.api_host + url;
    }
    if(id) { url = url + "/" + id; }
    metas.forEach(function(meta) {
      if(meta.method == method && (url == meta.url || (store == meta.model && id == meta.id))) {
        res = meta.meta;
      }
    });
    return res;
  };
  extras.meta = Ember.$.ajax.meta;
  extras.meta_push = Ember.$.ajax.meta_push;

  window.coughDropExtras = extras;
  window.addEventListener('message', function(event) {
    if(event.source != window) { return; }
    if(event.data && event.data.from_extension) {
      extras.extension_message(event.data);
    }
  });
  capabilities.invoke({type: 'coughDropExtras', method: 'init'});
})();

export default window.coughDropExtras;
