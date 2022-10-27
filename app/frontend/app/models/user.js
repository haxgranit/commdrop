import EmberObject from '@ember/object';
import RSVP from 'rsvp';
import DS from 'ember-data';
import Ember from 'ember';
import CoughDrop from '../app';
import speecher from '../utils/speecher';
import persistence from '../utils/persistence';
import app_state from '../utils/app_state';
import coughDropExtras from '../utils/extras';
import editManager from '../utils/edit_manager';
import progress_tracker from '../utils/progress_tracker';
import capabilities from '../utils/capabilities';
import Utils from '../utils/misc';
import { set as emberSet, get as emberGet } from '@ember/object';
import { later as runLater } from '@ember/runloop';
import stashes from '../utils/_stashes';
import i18n from '../utils/i18n';
import ButtonSet from '../models/buttonset';
import modal from '../utils/modal';
import BoardHierarchy from '../utils/board_hierarchy';
import { observer } from '@ember/object';
import { computed } from '@ember/object';

CoughDrop.User = DS.Model.extend({
  didLoad: function() {
    this.checkForDataURL().then(null, function() { });
    if(this.get('preferences') && !this.get('preferences.stretch_buttons')) {
      this.set('preferences.stretch_buttons', 'none');
    }
  },
  user_name: DS.attr('string'),
  user_token: DS.attr('string'),
  link: DS.attr('string'),
  joined: DS.attr('date'),
  sync_stamp: DS.attr('string'),
  settings: DS.attr('raw'),
  is_admin: DS.attr('boolean'),
  authored_organization_id: DS.attr('string'),
  terms_agree: DS.attr('boolean'),
  name: DS.attr('string'),
  email: DS.attr('string'),
  needs_billing_update: DS.attr('string'),
  public: DS.attr('boolean'),
  pending: DS.attr('boolean'),
  description: DS.attr('string'),
  details_url: DS.attr('string'),
  avatar_url: DS.attr('string'),
  fallback_avatar_url: DS.attr('string'),
  prior_avatar_urls: DS.attr('raw'),
  location: DS.attr('string'),
  permissions: DS.attr('raw'),
  unread_messages: DS.attr('number'),
  unread_alerts: DS.attr('number'),
  last_message_read: DS.attr('number'),
  last_alert_access: DS.attr('number'),
  last_access: DS.attr('date'),
  membership_type: DS.attr('string'),
  subscription: DS.attr('raw'),
  org_assistant: DS.attr('boolean'),
  org_manager: DS.attr('boolean'),
  org_supervision_pending: DS.attr('boolean'),
  organizations: DS.attr('raw'),
  password: DS.attr('string'),
  old_password: DS.attr('string'),
  referrer: DS.attr('string'),
  ad_referrer: DS.attr('string'),
  preferences: DS.attr('raw'),
  global_integrations: DS.attr('raw'),
  devices: DS.attr('raw'),
  requested_phrase_changes: DS.attr('raw'),
  premium_voices: DS.attr('raw'),
  purchase_duration: DS.attr('number'),
  feature_flags: DS.attr('raw'),
  prior_home_boards: DS.attr('raw'),
  supervisor_key: DS.attr('string'),
  supervisors: DS.attr('raw'),
  supervisee_code: DS.attr('string'),
  supervised_units: DS.attr('raw'),
  supervisees: DS.attr('raw'),
  offline_actions: DS.attr('raw'),
  vocalizations: DS.attr('raw'),
  contacts: DS.attr('raw'),
  goal: DS.attr('raw'),
  pending_board_shares: DS.attr('raw'),
  edit_permission: DS.attr('boolean'),
  cell_phone: DS.attr('string'),
  next_notification_delay: DS.attr('string'),
  read_notifications: DS.attr('boolean'),
  supervisors_or_managing_org: computed('supervisors', 'managing_org', function() {
    return (this.get('supervisors') || []).length > 0 || this.get('managing_org');
  }),
  has_management_responsibility: computed('managed_orgs', function() {
    return this.get('managed_orgs').length > 0;
  }),
  is_sponsored: computed('organizations', function() {
    return !!(this.get('organizations') || []).find(function(o) { return o.type == 'user' && o.sponsored; });
  }),
  is_managed: computed('organizations', function() {
    return !!(this.get('organizations') || []).find(function(o) { return o.type == 'user'; });
  }),
  managing_org: computed('organizations', function() {
    return (this.get('organizations') || []).find(function(o) { return o.type == 'user'; });
  }),
  manages_multiple_orgs: computed('managed_orgs', function() {
    return this.get('managed_orgs').length > 1;
  }),
  managed_orgs: computed('organizations', function() {
    return (this.get('organizations') || []).filter(function(o) { return o.type == 'manager'; });
  }),
  managing_supervision_orgs: computed('organizations', function() {
    return (this.get('organizations') || []).filter(function(o) { return o.type == 'supervisor'; });
  }),
  pending_org: computed('organizations', function() {
    return (this.get('organizations') || []).find(function(o) { return o.type == 'user' && o.pending; });
  }),
  pending_supervision_org: computed('organizations', function() {
    return (this.get('organizations') || []).find(function(o) { return o.type == 'supervisor' && o.pending; });
  }),
  supervisor_names: computed('supervisors', 'is_managed', 'managing_org.name', function() {
    var names = [];
    if(this.get('is_managed') && this.get('managing_org.name')) {
      names.push(this.get('managing_org.name'));
    }
    names = names.concat((this.get('supervisors') || []).map(function(u) { return u.name; }));
    return names.join(", ");
  }),
  supervisee_names: computed('supervisees', function() {
    return (this.get('supervisees') || []).map(function(u) { return u.name; }).join(", ");
  }),
  notifications: DS.attr('raw'),
  parsed_notifications: computed('notifications', function() {
    var notifs = this.get('notifications') || [];
    notifs.forEach(function(notif) {
      notif[notif.type] = true;
      notif.occurred_at = (Date.parse(notif.occurred_at) || new Date(notif.occurred_at));
    });
    return notifs;
  }),
  update_voice_uri: observer(
    'preferences.device.voice.voice_uri',
    'preferences.device.voice.voice_uris',
    'preferences.device.alternate_voice.voice_uri',
    'preferences.device.alternate_voice.voice_uris',
    function() {
      if(this.get('preferences.device.voice')) {
        var voice = null;
        var voices = speecher.get('voices');
        var voiceURIs = this.get('preferences.device.voice.voice_uris') || [];
        if(this.get('preferences.device.voice.voice_uri')) { voiceURIs.unshift(this.get('preferences.device.voice.voice_uri')); }
        var finder = function(v) { return v.voiceURI == voiceURI; };
        for(var idx = 0; idx < voiceURIs.length && !voice; idx++) {
          var voiceURI = voiceURIs[idx];
          voice = voices.find(finder);
          if(voiceURI == 'force_default') {
            voice = {voiceURI: 'force_default'};
          }
        }
        this.set('preferences.device.voice.voice_uri', voice && voice.voiceURI);
      }
      if(this.get('preferences.device.alternate_voice')) {
        var voice = null;
        var voices = speecher.get('voices');
        var voiceURIs = this.get('preferences.device.alternate_voice.voice_uris') || [];
        if(this.get('preferences.device.alternate_voice.voice_uri')) { voiceURIs.unshift(this.get('preferences.device.alternate_voice.voice_uri')); }
        var finder = function(v) { return v.voiceURI == voiceURI; };
        for(var idx = 0; idx < voiceURIs.length && !voice; idx++) {
          var voiceURI = voiceURIs[idx];
          voice = voices.find(finder);
          if(voiceURI == 'force_default') {
            voice = {voiceURI: 'force_default'};
          }
        }
        this.set('preferences.device.alternate_voice.voice_uri', voice && voice.voiceURI);
      }
    }
  ),
  stats: DS.attr('raw'),
  avatar_url_with_fallback: computed('avatar_url', 'avatar_data_uri', function() {
    var url = this.get('avatar_data_uri') || this.get('avatar_url');
    if(!url) {
      url = Ember.templateHelpers.path('images/action.png');
    }
    return url;
  }),
  using_for_a_while: computed('joined', 'app_state.refresh_stamp', function() {
    var a_while_ago = window.moment().add(-2, 'weeks');
    var joined = window.moment(this.get('joined'));
    return (joined < a_while_ago);
  }),
  // full premium means fully-featured premium, as in a paid communicator or free trial period
  currently_premium: computed('expired', 'free_premium', function() {
    return !this.get('expired') && !this.get('free_premium');
  }),
  currently_premium_or_fully_purchased: computed('currently_premium', 'fully_purchased', function() {
    return !!(this.get('currently_premium') || this.get('fully_purchased'));
  }),
  currently_premium_or_supporter_role: computed('currently_premium', 'supporter_role', function() {
    return !!(this.get('currently_premium') || this.get('supporter_role'));
  }),
  // limited_supervisor means they aren't tied to an org or any non-currently-premium supervisees, so
  // they need a little bit of reminding of the purpose of supervisor accounts.
  limited_supervisor: computed('subscription.limited_supervisor', 'currently_premium', function() {
    return !!(this.get('subscription.limited_supervisor') && !this.get('currently_premium'));
  }),
  // free premium means limited functionality, as in a free supporter
  free_premium: computed(
    'subscription.free_premium',
    'supporter_role',
    'expiration_passed',
    'fully_purchased',
    function() {
      if(this.get('subscription.free_premium')) { return true; }
      // auto-convert a free-trial supporter to free_premium when their trial expires
      if(this.get('supporter_role')) {
        if(this.get('expiration_passed')) { return true; }
      }
      else if(!this.get('supporter_role') && this.get('fully_purchased') && this.get('expiration_passed')) { return true; }
      return false;
    }
  ),
  expiration_passed: computed('subscription.expires', 'app_state.refresh_stamp', function() {
    if(!this.get('subscription.expires')) { return false; }
    var now = window.moment();
    var expires = window.moment(this.get('subscription.expires'));
    return expires < now;
  }),
  expired: computed('expiration_passed', 'membership_type', 'supporter_role', function() {
    if(this.get('membership_type') != 'premium') { return true; }
    var passed = this.get('expiration_passed');
    if(!passed) { return false; }
    if(this.get('supporter_role')) { return false; }
    return !!passed;
  }),
  expired_or_limited_supervisor: computed('expired', 'limited_supervisor', 'supporter_role', function() {
    return !!((this.get('expired') && !this.get('supporter_role')) || this.get('limited_supervisor'));
  }),
  joined_within_24_hours: computed('app_state.refresh_stamp', 'joined', function() {
    var one_day_ago = window.moment().add(-1, 'day');
    if(this.get('joined') && this.get('joined') > one_day_ago) {
      return true;
    }
    return false;
  }),
  really_expired: computed('expired', 'subscription.expires', 'fully_purchased', function() {
    if(!this.get('expired')) { return false; }
    if(this.get('fully_purchased')) { return false; }
    var now = window.moment();
    var expires = window.moment(this.get('subscription.expires')).add(14, 'day');
    return (expires < now);
  }),
  really_really_expired: computed('expired', 'subscription.expires', 'fully_purchased', function() {
    if(!this.get('expired')) { return false; }
    if(this.get('fully_purchased')) { return false; }
    var now = window.moment();
    var expires = window.moment(this.get('subscription.expires')).add(6, 'month');
    return (expires < now);
  }),
  fully_purchased: computed('subscription.fully_purchased', function() {
    return !!this.get('subscription.fully_purchased');
  }),
  grace_period: computed(
    'subscription.grace_period',
    'supporter_role',
    'expiration_passed',
    function() {
      if(this.get('supporter_role') && this.get('expiration_passed')) { return false; }
      else if(!this.get('subscription.grace_period')) { return false; }
      else if(this.get('expiration_passed')) { return false; }
      else { return true; }
    }
  ),
  expired_or_grace_period: computed('expired', 'grace_period', function() {
    return !!(this.get('expired') || this.get('grace_period'));
  }),
  supporter_role: computed('preferences.role', function() {
    return this.get('preferences.role') == 'supporter';
  }),
  profile_url: computed('user_name', function() {
    return location.protocol + '//' + location.host + '/' + this.get('user_name');
  }),
  multiple_devices: computed('devices', function() {
    return (this.get('devices') || []).length > 1;
  }),
  device_count: computed('devices', function() {
    return (this.get('devices') || []).length;
  }),
  current_device_name: computed('devices', function() {
    var device = (this.get('devices') || []).findBy('current_device', true);
    return (device && device.name) || "Unknown device";
  }),
  access_method: computed(
    'preferences.device.scanning',
    'preferences.device.scan_mode',
    'preferences.device.dwell',
    'preferences.device.dwell_type',
    function() {
      if(this.get('preferences.device.scanning')) {
        if(this.get('preferences.device.scan_mode') == 'axes') {
          return 'axis_scanning';
        } else {
          return 'scanning';
        }
      } else if(this.get('preferences.device.dwell')) {
        if(this.get('preferences.device.dwell_type') == 'arrow_dwell') {
          return 'arrow_dwell';
        } else {
          return 'dwell';
        }
      } else {
        return 'touch';
      }
    }
  ),
  hide_symbols: computed(
    'preferences.device.button_text',
    'preferences.device.button_text_position',
    function() {
      return this.get('preferences.device.button_text') == 'text_only' || this.get('preferences.device.button_text_position') == 'text_only';
    }
  ),
  remove_device: function(id) {
    var url = '/api/v1/users/' + this.get('user_name') + '/devices/' + id;
    var _this = this;
    return persistence.ajax(url, {type: 'POST', data: {'_method': 'DELETE'}}).then(function(res) {
      var devices = _this.get('devices') || [];
      var new_devices = [];
      for(var idx = 0; idx < devices.length; idx++) {
        if(devices[idx].id != id) {
          new_devices.push(devices[idx]);
        }
      }
      _this.set('devices', new_devices);
    });
  },
  rename_device: function(id, name) {
    var url = '/api/v1/users/' + this.get('user_name') + '/devices/' + id;
    var _this = this;
    return persistence.ajax(url, {type: 'POST', data: {'_method': 'PUT', device: {name: name}}}).then(function(res) {
      var devices = _this.get('devices') || [];
      var new_devices = [];
      for(var idx = 0; idx < devices.length; idx++) {
        if(devices[idx].id != id) {
          new_devices.push(devices[idx]);
        } else {
          new_devices.push(res);
        }
      }
      _this.set('devices', new_devices);
    });
  },
  sidebar_boards_with_fallbacks: computed('preferences.sidebar_boards', function() {
    var boards = this.get('preferences.sidebar_boards') || [];
    var res = [];
    boards.forEach(function(board) {
      var board_object = EmberObject.create(board);
      persistence.find_url(board.image, 'image').then(function(data_uri) {
        board_object.set('image', data_uri);
      }, function() { });
      res.push(board_object);
    });
    return res;
  }),
  checkForDataURL: function() {
    this.set('checked_for_data_url', true);
    var url = this.get('avatar_url_with_fallback');
    var _this = this;
    if(!this.get('avatar_data_uri') && url && url.match(/^http/)) {
      return persistence.find_url(url, 'image').then(function(data_uri) {
        _this.set('avatar_data_uri', data_uri);
        return _this;
      });
    } else if(url && url.match(/^data/)) {
      return RSVP.resolve(this);
    }
    return RSVP.reject('no user data url');
  },
  checkForDataURLOnChange: observer('avatar_url', function() {
    this.checkForDataURL().then(null, function() { });
  }),
  validate_pin: observer('preferences.speak_mode_pin', function() {
    var pin = this.get('preferences.speak_mode_pin');
    var new_pin = (pin || "").replace(/[^\d]/g, '').substring(0, 4);
    if(pin && pin != new_pin) {
      this.set('preferences.speak_mode_pin', new_pin);
    }
  }),
  needs_speak_mode_intro: computed('joined', function() {
    var joined = window.moment(this.get('joined'));
    var cutoff = window.moment('2018-02-20');
    if(joined >= cutoff) {
      return true;
    }
    return false;
  }),
  auto_sync: computed(
    'preferences.device.auto_sync',
    'preferences.device.ever_synced',
    function() {
      var ever_synced = this.get('preferences.device.ever_synced');
      var auto_sync = this.get('preferences.device.auto_sync');
      if(auto_sync === true || auto_sync === false) {
        return auto_sync;
      } else {
        if(capabilities.installed_app) {
          return true;
        } else if(ever_synced === true) {
          return true;
        } else if(ever_synced === false) {
          return false;
        } else if(ever_synced == null) {
          return true;
        }
      }
    }
  ),
  load_more_supervision: observer('load_all_connections', 'sync_stamp', function() {
    var _this = this;
    var localize_connections = function(sups) {
      (sups || []).forEach(function(sup) {
        if(sup.avatar_url && sup.avatar_url.match(/^http/)) {
          persistence.find_url(sup.avatar_url, 'image').then(function(uri) {
            emberSet(sup, 'original_avatar_url', sup.avatar_url);
            emberSet(sup, 'avatar_url', uri);
          }, function() { });
        } else if(sup.avatar_url) {
          emberSet(sup, 'avatar_url', capabilities.storage.fix_url(sup.avatar_url, true));
        }
      });
    };
    if(this.get('load_all_connections') && (!this.get('all_connections.loaded') || this.get('all_connections.stamp') != this.get('sync_stamp'))) {
      _this.set('all_connections', {loading: true, sync_stamp: _this.get('sync_stamp')});
      var defer = RSVP.defer();
      _this.set('all_connections_promise', defer.promise);
      var advance = function(type) {
        defer[type] = true;
        if(defer.supervisors && defer.supervisees) {
          defer.resolve();
        }
      };
      if((this.get('supervisors') || []).length >= 10) {
        Utils.all_pages('/api/v1/users/' + this.get('id') + '/supervisors', {result_type: 'user', type: 'GET', data: {}}, function(data) {
        }).then(function(res) {
          _this.set('supervisors', res);
          localize_connections(res);
          _this.set('all_connections.supervisors', true);
          advance('supervisors');
        }, function(err) {
          console.log('error loading supervisors');
          console.log(err);
          _this.set('all_connections.error', true);
          advance('supervisors');
        });
      } else {
        localize_connections(_this.get('supervisors'));
        _this.set('all_connections.supervisors', true);
        advance('supervisors');
      }
      if((this.get('supervisees') || []).length >= 10) {
        Utils.all_pages('/api/v1/users/' + this.get('id') + '/supervisees', {result_type: 'user', type: 'GET', data: {}}, function(data) {
        }).then(function(res) {
          _this.set('supervisees', res);
          _this.set('all_supervisees', res);
          localize_connections(res);
          _this.set('all_connections.supervisees', true);
          advance('supervisees');
        }, function(err) {
          console.log('error loading supervisees');
          console.log(err);
          _this.set('all_connections.error', true);
          advance('supervisees');
        });
      } else {
        localize_connections(_this.get('supervisees'));
        _this.set('all_connections.supervisees', true);
        advance('supervisees');
      }
      _this.set('all_connections_loaded', true);
    }
  }),
  known_supervisees: computed('all_supervisees', 'supervisees', function() {
    return this.get('all_supervisees') || this.get('supervisees') || [];
  }),
  check_all_connections: observer(
    'all_connections',
    'all_connections.supervisors',
    'all_connections.supervisees',
    function() {
      if(this.get('all_connections.supervisors') && this.get('all_connections.supervisees')) {
        this.set('all_connections.loading', null);
        this.set('all_connections.loaded', true);
      }
    }
  ),
  load_active_goals: function() {
    var _this = this;
    this.store.query('goal', {active: true, user_id: this.get('id')}).then(function(list) {
      _this.set('active_goals', list.map(function(i) { return i; }).sort(function(a, b) {
        if(a.get('primary')) {
          return -1;
        } else if(b.get('primary')) {
          return 1;
        } else {
          return a.get('id') - b.get('id');
        }
      }));
    }, function() { });
  },
  find_button: function(label) {
    return this.load_button_sets().then(function(list) {
      var promises = [];
      var closest = list.length + 1;
      var best = null;
      list.forEach(function(bs, idx) {
        promises.push(bs.find_buttons(label).then(function(res) {
          res.forEach(function(btn) {
            if(btn.label && label && btn.label.toLowerCase() == label.toLowerCase() && idx < closest) {
              best = btn;
            }
          });
        }));
      });
      return RSVP.all_wait(promises).then(function() {
        if(best) {
          return best;
        } else {
          return RSVP.reject({error: 'no exact matches found'});
        }
      });
    });
  },
  load_button_sets: function() {
    var ids = [];
    if(this.get('preferences.home_board.id')) {
      ids.push(this.get('preferences.home_board.id'));
    }
    (this.get('preferences.sidebar_boards') || []).forEach(function(b) {
      if(b.key) {
        ids.push(b.key);
      }
    });
    var promises = [];
    var list = [];
    ids.forEach(function(id, idx) {
      promises.push(CoughDrop.Buttonset.load_button_set(id).then(function(bs) {
        list[idx] = bs;
      }));
    });
    return RSVP.all_wait(promises).then(function() {
      var res = [];
      list.forEach(function(i) { if(i) { res.push(i); } });
      return res;
    });
  },
  check_integrations: function(reload) {
    var res = null;
    var _this = this;
    if(this.get('permissions.supervise')) {
      _this.set('integrations', {loading: true});
      res = CoughDrop.User.check_integrations(this.get('id'), reload);
    } else {
      res = RSVP.reject({error: 'not allowed'});
    }
    if(res && res.then) {
      res.then(function(ints) {
        _this.set('integrations', ints);
      }, function(err) {
        _this.set('integrations', err);
      });
    }
    return res;
  },
  find_integration: function(key, supervisee_user_name) {
    var search_user = CoughDrop.User.find_integration(this.get('id'), key);
    var user = this;
    var supervisee_fallback = search_user.then(null, function(err) {
      if(err.error == 'no matching integration found' && supervisee_user_name) {
        var sup = (user.get('supervisees') || []).find(function(sup) { return sup.user_id == supervisee_user_name || sup.user_name == supervisee_user_name });
        if(sup) {
          return CoughDrop.User.find_integration(sup.user_id || sup.user_name, key);
        } else {
          return RSVP.reject({error: 'no matching integration found for user or board author'});
        }
      } else {
        return RSVP.reject(err);
      }
    });
    return supervisee_fallback;
  },
  add_action: function(action) {
    var actions = this.get('offline_actions') || [];
    actions.push(action);
    this.set('offline_actions', actions);
  },
  copy_home_board: function(board, swap_images) {
    var user = this;
    var board_key = emberGet(board, 'key');
    var board_id = emberGet(board, 'id');
    var preferred_symbols = user.get('preferences.preferred_symbols') || 'original';
    var copy_promise = new RSVP.Promise(function(resolve, reject) {
      user.set('home_board_pending', board_key);
      CoughDrop.store.findRecord('board', board_id).then(function(board) {
        var swap_library = null;
        if(swap_images && preferred_symbols && preferred_symbols != 'original') { swap_library = user.get('preferences.preferred_symbols'); }
        editManager.copy_board(board, 'links_copy_as_home', user, false, swap_library).then(function(new_board) {
          user.set('home_board_pending', false);
          if(persistence.get('online') && persistence.get('auto_sync')) {
            runLater(function() {
              if(persistence.get('auto_sync')) {
                console.debug('syncing because home board changes');
                persistence.sync('self', null, null, 'home_board_copied').then(null, function() { });
              }
            }, 1000);
          }
          user.set('home_board_copy', {id: user.get('preferences.home_board.id'), at: (new Date()).getTime()});
          resolve(new_board);
        }, function() {
          user.set('home_board_pending', false);
          reject({error: 'copy failed'});
        });
      }, function() {
        user.set('home_board_pending', false);
        reject({error: 'board not found'});
      });
    });
    copy_promise.then(null, function() { return RSVP.resolve(); }).then(function() {
      if(user.get('copy_promise') == copy_promise) {
        user.set('copy_promise', null);
      }
    });
    user.set('copy_promise', copy_promise);
    return copy_promise;
  },
  assert_local_boards: function() {
    var _this = this;
    var user_name = _this.get('user_name');
    return new RSVP.Promise(function(resolve, reject) {
      // ensure you're online
      if(persistence.get('online')) {
        // retrieve all locally-saved boards
        return coughDropExtras.storage.find_all('board').then(function(list) {
          var promises = [];
          list.forEach(function(item) {
            // filter to only those owned by the current user
            if(item.data && item.data.raw && item.data.raw.user_name == user_name) {
              // load each local copy and call .save to PUT the local version
              var existing = CoughDrop.store.peekRecord('board', item.data.raw.id);
              if(!existing) {
                var json_api = { data: {
                  id: item.data.raw.id,
                  type: 'board',
                  attributes: item.data.raw
                }};
                existing = CoughDrop.store.push(json_api);
              }
              for(var key in item.data.raw) {
                existing.set(key, item.data.raw[key]);
              }
              promises.push(existing.save());
            }
          });
          RSVP.all_wait(promises).then(function(res) {
            resolve(list);
          }, function(err) {
            reject({error: err, save_failed: true});
          });
        }, function(err) {
          reject(err);
        });      
      } else {
        reject({error: 'not online'});
      }
    });
  },
  swap_home_board_images: function(swap_library) {
    var user = this;
    user.set('preferred_symbols_changed', null);
    user.set('original_preferred_symbols', null);
    var now = (new Date()).getTime();
    var re = new RegExp("^" + user.get('user_name') + "\\\/");
    var board_id = user.get('preferences.home_board.id');
    var swap_library = user.get('preferences.preferred_symbols')
    var defer = RSVP.defer();
    var find = CoughDrop.store.findRecord('board', board_id).then(function(board) {
      defer.ready_to_swap = function(board_id) {
        var err = function() {
          modal.error(i18n.t('error_swapping_images', "There was an unexpected error when trying to update your home board's symbol library"));
          defer.reject();
        };
        // retrieve board
        BoardHierarchy.load_with_button_set(board, {prevent_keyboard: true, prevent_different: true}).then(function(hierarchy) {
          var board_ids_to_include = hierarchy.selected_board_ids();
          persistence.ajax('/api/v1/boards/' + board_id + '/swap_images', {
            type: 'POST',
            data: {
              library: swap_library,
              board_ids_to_convert: board_ids_to_include
            }
          }).then(function(res) {
            progress_tracker.track(res.progress, function(event) {
              if(event.status == 'errored') {
                err();
              } else if(event.status == 'finished') {
                // reload board and re-sync
                runLater(function() {
                  board.reload(true).then(function() {
                    if(persistence.get('auto_sync')) {
                      console.debug('syncing because home board symbol changes');
                      persistence.sync('self', null, null, 'home_board_symbols_changed').then(null, function() { });
                    }
                  }, function() { });
                  defer.resolve();
                });
              }
            });
          }, function(res) {
            err();
          });  
        }, function(err) {
          err();
        });
      }
    }, function() { defer.reject(); });
    if(user.get('copy_promise')) {
      // If the user's home board is copying, queue a swap_images call
      user.get('copy_promise').then(function(new_board) {
        find.then(function() {
          defer.ready_to_swap(new_board.get('id')); 
        })
      });
    } else if(user.get('home_board_copy') && user.get('home_board_copy.at') > (now - (60 * 60 * 1000)) && user.get('home_board_copy.id') == board_id) {
      // If the user's home board is brand new, trigger a swap_images call
      find.then(function() {
        defer.ready_to_swap(board_id);
      })
    } else if(user.get('preferences.home_board.key').match(re)) {
      // If the user's home board is owned by them but not brand new, open the swap-images modal with a special prompt
      defer.promise.wait = true;
      find.then(function(board) {
        modal.open('swap-images', {board: board, button_set: board.get('button_set'), library: swap_library, confirmation: true}).then(function() {
          defer.resolve();        
        });  
      });
    }

    return defer.promise;
  },
  check_user_name: observer('watch_user_name_and_cookies', 'user_name', function() {
    if(this.get('watch_user_name_and_cookies')) {
      var user_name = this.get('user_name');
      var user_id = this.get('id');
      this.set('user_name_check', null);
      if(user_name && user_name.length > 2) {
        var _this = this;
        _this.set('user_name_check', {checking: true});
        this.store.findRecord('user', user_name).then(function(u) {
          if(user_name == _this.get('user_name') && u.get('id') != user_id) {
            _this.set('user_name_check', {exists: true});
          }
        }, function() {
          if(user_name == _this.get('user_name')) {
           _this.set('user_name_check', {exists: false});
          }
          return RSVP.resolve();
        });
      }
    }
  }),
  toggle_cookies: observer('watch_user_name_and_cookies', 'preferences.cookies', function() {
    if(this.get('watch_user_name_and_cookies') && this.get('preferences.cookies') != undefined) {
      app_state.toggle_cookies(!!this.get('preferences.cookies'));
    }
  }),
  load_word_activities: function() {
    // if already loaded for the user, keep the local copy unless it's really old
    var _this = this;
    if(this.get('word_activities')) {
      if(this.get('word_activities.promise')) {
        return this.get('word_activities.promise');
      }
      var cutoff = window.moment().add(-3, 'days').toISOString();
      if(this.get('word_activities.checked') > cutoff) {
        return RSVP.resolve(this.get('word_activities'));
      }
    }
    var try_online = RSVP.reject();
    // try a remote lookup, which will possibly return a progress object
    if(persistence.get('online')) {
      try_online = persistence.ajax('/api/v1/users/' + _this.get('id') + '/word_activities', {type: 'GET'}).then(function(res) {
        if(res.progress) {
          return new RSVP.Promise(function(resolve, reject) {
            progress_tracker.track(res.progress, function(event) {
              if(event.status == 'errored') {
                reject({error: 'processing failed'});
              } else if(event.status == 'finished') {
                resolve(event.result);
              }
            });
          });
        } else {
          return RSVP.resolve(res);
        }
      });
    }
    // if not possible or errored, check for a local copy in the dataCache
    var try_local = try_online.then(function(res) {
      // persist to dataCache
      persistence.store('dataCache', res, 'word_activities/' + _this.get('id')).then(null, function() { });
      _this.set('word_activities', res);
      return RSVP.resolve(res);
    }, function() {
      return persistence.find('dataCache', 'word_activities/' + _this.get('id'));
      // look up a local copy
    });
    var promise_result = try_local.then(function(res) {
      res.local_log = [];
      return persistence.find('dataCache', 'word_log/' + _this.get('id')).then(function(list) {
        res.local_log = list;
        return res;
      }, function() { return RSVP.resolve(res); });
    });
    promise_result.then(null, function() { });
    this.set('word_activities', {promise: promise_result});
    return promise_result;
  },
  log_word_activity: function(opts) {
    opts.timestamp = stashes.current_timestamp();
    var user_id = this.get('id');
    stashes.log_event(opts, user_id);
    stashes.push_log(true);
    persistence.find('dataCache', 'word_log/' + user_id).then(null, function() { return RSVP.resolve([]); }).then(function(list) {
      var cutoff = parseInt(window.moment().add(-2, 'week').format('X'), 10);
      list = list.filter(function(e) { return e.timestamp > cutoff; });
      list.push(opts);
      persistence.store('dataCache', list, 'word_log/' + user_id).then(null, function() { });
    });
  }
});
CoughDrop.User.integrations_for = {};
CoughDrop.User.find_integration = function(user_name, key) {
  var integrations_for = CoughDrop.User.integrations_for;
  var loading = integrations_for[user_name] && integrations_for[user_name].promise;
  if(!loading) {
    if(integrations_for[user_name] && integrations_for[user_name].length) {
      loading = RSVP.resolve(integrations_for[user_name]);
    } else {
      loading = CoughDrop.User.check_integrations(user_name);
    }
  }
  return loading.then(function(list) {
    if(list && list.length > 0) {
      var res = list.find(function(integration) { return integration.get('template_key') == key; });
      if(res) {
        return res;
      } else {
        return RSVP.reject({error: 'no matching integration found'});
      }
    } else {
      return RSVP.reject({error: 'no matching integration found'});
    }
  });
};
CoughDrop.User.check_integrations = function(user_name, reload) {
  var integrations_for = CoughDrop.User.integrations_for;
  if(integrations_for[user_name] && integrations_for[user_name].promise) {
    return integrations_for[user_name].promise;
  }
  if(reload === true) { integrations_for[user_name] = null; }
  if(integrations_for[user_name]) {
    return RSVP.resolve(integrations_for[user_name]);
  }
  var promise = Utils.all_pages('integration', {user_id: user_name}, function(partial) {
  }).then(function(res) {
    CoughDrop.User.integrations_for[user_name] = res;
    return res;
  }, function(err) {
    CoughDrop.User.integrations_for[user_name] = {error: true};
    return RSVP.reject({error: 'error retrieving integrations'});
  });
  promise.then(null, function() { });
  CoughDrop.User.integrations_for[user_name] = {loading: true, promise: promise};
  return promise;
};

export default CoughDrop.User;
