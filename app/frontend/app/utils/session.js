import Ember from 'ember';
import stashes from './_stashes';
import CoughDrop from '../app';
import capabilities from './capabilities';
import persistence from './persistence';
import coughDropExtras from './extras';
import app_state from './app_state';


var session = Ember.Object.extend({
  setup: function(container, application) {
    application.register('cough_drop:session', session, { instantiate: false, singleton: true });
    Ember.$.each(['model', 'controller', 'view', 'route'], function(i, component) {
      application.inject(component, 'session', 'cough_drop:session');
    });
    CoughDrop.session = session;
  },
  persist: function(data) {
    stashes.persist_object('auth_settings', data, true);
  },
  clear: function() {
    stashes.flush('auth_');
  },
  authenticate: function(credentials) {
    var _this = this;
    var res = new Ember.RSVP.Promise(function(resolve, reject) {
      var data = {
        grant_type: 'password',
        client_id: 'browser',
        client_secret: credentials.client_secret,
        username: credentials.identification,
        password: credentials.password,
        device_id: capabilities.device_id,
        long_token: credentials.long_token,
        mobile: (!!capabilities.mobile).toString()
      };

      persistence.ajax('/token', {method: 'POST', data: data}).then(function(response) {
        Ember.run(function() {
          session.persist({
            access_token: response.access_token,
            user_name: response.user_name,
          });
          stashes.persist_object('just_logged_in', true, false);
          resolve(response);
        });
      }, function(data) {
        var xhr = data.fakeXHR || {};
        Ember.run(function() {
          reject(xhr.responseJSON || xhr.responseText);
        });
      });
    });
    res.then(null, function() { });
    return res;
  },
  restore: function(force_check_for_token) {
    if(!stashes.get('enabled')) { return {}; }
    var store_data = stashes.get_object('auth_settings', true) || {};
    var key = store_data.access_token || "none";
    persistence.tokens = persistence.tokens || {};
    if(store_data.access_token && !session.get('isAuthenticated')) {
      session.set('isAuthenticated', true);
      session.set('access_token', store_data.access_token);
      session.set('user_name', store_data.user_name);
      session.set('as_user_id', store_data.as_user_id);
    } else if(!store_data.access_token) {
      session.invalidate();
    }
    if(persistence.tokens[key] == null && !Ember.testing && persistence.get('online')) {
      if(store_data.access_token || force_check_for_token) { // || !persistence.get('browserToken')) {
        persistence.tokens[key] = true;
        var url = '/api/v1/token_check?access_token=' + store_data.access_token;
        if(store_data.as_user_id) {
          url = url + "&as_user_id=" + store_data.as_user_id;
        }
        persistence.ajax(url, {
          type: 'GET'
        }).then(function(data) {
          if(data.authenticated !== true) {
            session.invalidate(true);
          }
          if(data.sale !== undefined) {
            CoughDrop.sale = parseInt(data.sale, 10) || false;
          }
          if(data.meta && data.meta.fakeXHR && data.meta.fakeXHR.browserToken) {
            persistence.set('browserToken', data.meta.fakeXHR.browserToken);
          }
        }, function(data) {
          if(!persistence.get('online')) {
            return;
          }
          if(data.fakeXHR && data.fakeXHR.browserToken) {
            persistence.set('browserToken', data.fakeXHR.browserToken);
          }
          if(data.result && data.result.error == "not online") {
            return;
          }
          persistence.tokens[key] = false;
        });
      } else {
        session.set('tokenConfirmed', false);
      }
    }

    return store_data;
  },
  override: function(options) {
    var data = session.restore();
    data.access_token = options.access_token;
    data.user_name = options.user_name;
    stashes.flush();
    stashes.setup();
    session.persist(data);

    session.reload();
  },
  reload: function(path) {
    if(path) {
      if(capabilities.installed_app) {
        location.href = '#' + path;
        location.reload();
      } else {
        location.href = path;
      }
    } else {
      location.reload();
    }
  },
  invalidate: function() {
    var full_invalidate = !!(app_state.get('currentUser') || stashes.get_object('auth_settings', true));
    stashes.flush();
    stashes.setup();
    if(full_invalidate) {
      session.reload('/');
    }
    var _this = this;
    Ember.run.later(function() {
      session.set('isAuthenticated', false);
      session.set('access_token', null);
      session.set('user_name', null);
      session.set('as_user_id', null);
    });
  }
}).create({
});

export default session;
