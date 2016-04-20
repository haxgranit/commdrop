import Ember from 'ember';
import DS from 'ember-data';
import CoughDrop from '../app';
import speecher from '../utils/speecher';
import persistence from '../utils/persistence';
import Utils from '../utils/misc';

CoughDrop.User = DS.Model.extend({
  didLoad: function() {
    this.checkForDataURL().then(null, function() { });
    if(this.get('preferences') && !this.get('preferences.stretch_buttons')) {
      this.set('preferences.stretch_buttons', 'none');
    }
  },
  user_name: DS.attr('string'),
  link: DS.attr('string'),
  joined: DS.attr('date'),
  settings: DS.attr('raw'),
  is_admin: DS.attr('boolean'),
  terms_agree: DS.attr('boolean'),
  name: DS.attr('string'),
  email: DS.attr('string'),
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
  last_message_read: DS.attr('number'),
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
  devices: DS.attr('raw'),
  premium_voices: DS.attr('raw'),
  feature_flags: DS.attr('raw'),
  prior_home_boards: DS.attr('raw'),
  supervisor_key: DS.attr('string'),
  supervisors: DS.attr('raw'),
  supervisee_code: DS.attr('string'),
  supervisees: DS.attr('raw'),
  pending_board_shares: DS.attr('raw'),
  edit_permission: DS.attr('boolean'),
  has_management_responsibility: function() {
    return this.get('managed_orgs').length > 0;
  }.property('managed_orgs'),
  is_managed: function() {
    return !!(this.get('organizations') || []).find(function(o) { return o.type == 'user'; });
  }.property('organizations'),
  managing_org: function() {
    return (this.get('organizations') || []).find(function(o) { return o.type == 'user'; });
  }.property('managing_orgs'),
  manages_multiple_orgs: function() {
    return this.get('managed_orgs').length > 1;
  }.property('managing_orgs'),
  managed_orgs: function() {
    return (this.get('organizations') || []).filter(function(o) { return o.type == 'manager'; });
  }.property('organizations'),
  managing_supervision_orgs: function() {
    return (this.get('organizations') || []).filter(function(o) { return o.type == 'supervisor'; });
  }.property('organizations'),
  pending_org: function() {
    return (this.get('organizations') || []).find(function(o) { return o.type == 'user' && o.pending; });
  }.property('organizations'),
  pending_supervision_org: function() {
    return (this.get('organizations') || []).find(function(o) { return o.type == 'supervisor' && o.pending; });
  }.property('organizations'),
  supervisor_names: function() {
    var names = [];
    if(this.get('is_managed') && this.get('managing_org.name')) {
      names.push(this.get('managing_org.name'));
    }
    names = names.concat((this.get('supervisors') || []).map(function(u) { return u.name; }));
    return names.join(", ");
  }.property('supervisors', 'is_managed', 'managing_org.name'),
  supervisee_names: function() {
    return (this.get('supervisees') || []).map(function(u) { return u.name; }).join(", ");
  }.property('supervisees'),
  notifications: DS.attr('raw'),
  parsed_notifications: function() {
    var notifs = this.get('notifications') || [];
    notifs.forEach(function(notif) {
      notif[notif.type] = true;
      notif.occurred_at = Ember.Date.parse(notif.occurred_at);
    });
    return notifs;
  }.property('notifications'),
  update_voice_uri: function() {
    if(!this.get('preferences.device.voice')) { return; }
    var voice = null;
    var voices = speecher.get('voices');
    var voiceURIs = this.get('preferences.device.voice.voice_uris') || [];
    var finder = function(v) { return v.voiceURI == voiceURI; };
    for(var idx = 0; idx < voiceURIs.length && !voice; idx++) {
      var voiceURI = voiceURIs[idx];
      voice = voices.find(finder);
    }
    this.set('preferences.device.voice.voice_uri', voice && voice.voiceURI);
  }.observes('preferences.device.voice.voice_uris'),
  stats: DS.attr('raw'),
  avatar_url_with_fallback: function() {
    var url = this.get('avatar_data_uri') || this.get('avatar_url');
    if(!url) {
      url = "http://images.sodahead.com/polls/000547669/polls_profiles_1202SHAvatarFemaleRed_4335_157245_xlarge_3722_230918_poll_xlarge.jpeg";
    }
    return url;
  }.property('avatar_url', 'avatar_data_uri'),
  using_for_a_while: function() {
    var a_while_ago = window.moment().add(-3, 'weeks');
    var joined = window.moment(this.get('joined'));
    return (joined < a_while_ago);
  }.property('joined', 'app_state.refresh_stamp'),
  // full premium means fully-featured premium, as in a paid communicator or free trial period
  full_premium: function() {
    return !this.get('expired') && !this.get('free_premium');
  }.property('expired', 'free_premium'),
  // free premium means limited functionality, as in a free supporter
  free_premium: function() {
    return !!this.get('subscription.free_premium');
  }.property('subscription.free_premium'),
  expired: function() {
    if(this.get('membership_type') != 'premium') { return true; }
    if(!this.get('subscription.expires')) { return false; }
    var now = window.moment();
    var expires = window.moment(this.get('subscription.expires'));
    return (expires < now);
  }.property('membership_type', 'app_state.refresh_stamp', 'subscription.expires'),
  expired_or_limited_supervisor: function() {
    return !!(this.get('expired') || this.get('subscription.limited_supervisor'));
  }.property('expired', 'subscription.limited_supervisor'),
  joined_within_24_hours: function() {
    var one_day_ago = window.moment().add(-1, 'day');
    if(this.get('joined') && this.get('joined') > one_day_ago) {
      return true;
    }
    return false;
  }.property('app_state.refresh_stamp', 'joined'),
  really_expired: function() {
    if(!this.get('expired')) { return false; }
    var now = window.moment();
    var expires = window.moment(this.get('subscription.expires')).add(14, 'day');
    return (expires < now);
  }.property('expired', 'subscription.expires'),
  really_really_expired: function() {
    if(!this.get('expired')) { return false; }
    var now = window.moment();
    var expires = window.moment(this.get('subscription.expires')).add(1000, 'day');
    return (expires < now);
  }.property('expired', 'subscription.expires'),
  expired_or_grace_period: function() {
    return !!(this.get('expired') || this.get('subscription.grace_period'));
  }.property('expired', 'subscription.grace_period'),
  supporter_role: function() {
    return this.get('preferences.role') == 'supporter';
  }.property('preferences.role'),
  profile_url: function() {
    return location.protocol + '//' + location.host + '/' + this.get('user_name');
  }.property('user_name'),
  multiple_devices: function() {
    return (this.get('devices') || []).length > 1;
  }.property('devices'),
  device_count: function() {
    return (this.get('devices') || []).length;
  }.property('devices'),
  current_device_name: function() {
    var device = (this.get('devices') || []).findBy('current_device', true);
    return (device && device.name) || "Unknown device";
  }.property('devices'),
  hide_symbols: function() {
    return this.get('preferences.device.button_text') == 'text_only';
  }.property('preferences.device.button_text'),
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
  sidebar_boards_with_fallbacks: function() {
    var boards = this.get('preferences.sidebar_boards') || [];
    var res = [];
    boards.forEach(function(board) {
      var board_object = Ember.Object.create(board);
      persistence.find_url(board.image, 'image').then(function(data_uri) {
        board_object.set('image', data_uri);
      }, function() { });
      res.push(board_object);
    });
    return res;
  }.property('preferences.sidebar_boards'),
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
      return Ember.RSVP.resolve(this);
    }
    return Ember.RSVP.reject('no user data url');
  },
  checkForDataURLOnChange: function() {
    this.checkForDataURL().then(null, function() { });
  }.observes('avatar_url'),
  validate_pin: function() {
    var pin = this.get('preferences.speak_mode_pin');
    var new_pin = (pin || "").replace(/[^\d]/g, '').substring(0, 4);
    if(pin && pin != new_pin) {
      this.set('preferences.speak_mode_pin', new_pin);
    }
  }.observes('preferences.speak_mode_pin'),
  check_user_name: function() {
    if(this.get('watch_user_name')) {
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
          return Ember.RSVP.resolve();
        });
      }
    }
  }.observes('watch_user_name', 'user_name')
});

export default CoughDrop.User;
