import Ember from 'ember';
import CoughDrop from '../app';
import persistence from '../utils/persistence';
import stashes from '../utils/_stashes';
import coughDropExtras from '../utils/extras';
import app_state from '../utils/app_state';
import StoreBase from 'simple-auth/stores/base';
import AuthBase from 'simple-auth/authenticators/base';
import capabilities from '../utils/capabilities';
import MainSession from 'simple-auth/session';


var Store = StoreBase.extend({
  persist: function(data) {
    stashes.persist_object('auth_settings', data, true);
  },
  clear: function() {
    stashes.flush('auth_');
  },
  restore: function(force_check_for_token) {
    if(!stashes.get('enabled')) { return {}; }
    var store_data = stashes.get_object('auth_settings', true) || {};
    var session = Store.session;
    Store.store = this;
    var key = store_data.access_token || "none";
    persistence.tokens = persistence.tokens || {};
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
            CoughDrop.sale = !!data.sale;
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
          // TODO: this was killing the session on slow/choppy reconnect which is bad.
          if(session.get('isAuthenticated')) {
            console.debug('unexpected session invalidation');
//              session.invalidate(true);
          }
        });
      } else {
        session.set('tokenConfirmed', false);
      }
    }
    
    return store_data;
  }
});

var Authenticator = AuthBase.extend({
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
//           var expiresAt = _this.absolutizeExpirationTime(response.expires_in);
//           _this.scheduleAccessTokenRefresh(response.expires_in, expiresAt, response.refresh_token);
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
  restore: function(data) {
    var _this = this;
    if(data.access_token) {
      return Ember.RSVP.resolve(data);
    } else {
      return Ember.RSVP.reject();
    }
  }
});
// TODO: I think SimpleAuth has a notification mechanism to update session across
// windows. controllers.application.currentUser doesn't though, so things get out
// of sync right now. Seems like a .observes('session.isAuthenticated') could handle that.
var Session = MainSession.extend({
  init: function() {
    CoughDrop.session = this;
    Store.session = this;
//      this.store.session = this;
    if(stashes.get('enabled')) {
      return this._super();
    } else {
      return [];
    }
  },
  invalidate: function() {
    var full_invalidate = !!(app_state.get('currentUser') || stashes.get_raw('auth_access_token', true));
    stashes.flush();
    stashes.setup();
    if(full_invalidate) {
      if(!coughDropExtras.ready || !coughDropExtras.logout()) {
        this._super();
      }
    }
    var _this = this;
    Ember.run.later(function() {
      _this.set('isAuthenticated', false);
    });
  },
  override: function(options) {
    var data = Store.store.restore();
    data.access_token = options.access_token;
    data.user_name = options.user_name;
    data.authenticator = "authenticator:coughdrop";
    data.token_type = "bearer";
    stashes.flush();
    stashes.setup();
    this.store.persist(data);

    var _this = this;
    var restoredContent      = Store.store.restore();
    location.reload();
  }
});

export default {
  name: 'session',
  initialize: function(container, app) {
    container.register('authenticator:coughdrop', Authenticator);
    container.register('simple-auth-session-store:coughdrop-local-storage', Store);
    container.register('simple-auth-session:coughdrop', Session);

    CoughDrop.app = app;
    persistence.setup(container, app);
    stashes.connect(container, app);
    coughDropExtras.setup(container, app);
    app_state.setup(container, app);
  }
};
