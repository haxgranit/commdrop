import Ember from 'ember';
import modal from '../../utils/modal';
import CoughDrop from '../../app';
import app_state from '../../utils/app_state';

export default Ember.Controller.extend({
  load_logs: function() {
    var _this = this;
    _this.set('more_available', false);
    this.store.query('log', {user_id: this.get('user.id'), goal_id: this.get('model.id')}).then(function(list) {
      _this.set('logs', list.content.mapBy('record'));

      var meta = Ember.$.extend({}, list.meta);
      _this.set('meta', meta);
      _this.set('more_available', !!meta.next_url);
    }, function(err) {
    });
  },
  messages_only: function() {
    return true;
  }.property(),
  save_disabled: function() {
    return this.get('pending_save') || this.get('saving');
  }.property('pending_save', 'saving'),
  pending_save: function() {
    return !!this.get('video_pending');
  }.property('video_pending'),
  load_user_badges: function() {
    var _this = this;
    this.store.query('badge', {user_id: this.get('user.id'), goal_id: this.get('model.id')}).then(function(badges) {
      _this.set('user_badges', badges.content.mapBy('record'));
    }, function(err) {
    });

  }.observes('user.id', 'model.id', 'model.badges'),
  mapped_badges: function() {
    var user_badges = this.get('user_badges');
    if(user_badges) {
      var res = [];
      (this.get('model.badges') || []).forEach(function(badge) {
        var new_badge = Ember.$.extend({}, badge);
        new_badge.user_badge = user_badges.find(function(b) { return b.get('level') == badge.level; });
        res.push(new_badge);
      });
      return res;
    } else {
      return this.get('model.badges');
    }
  }.property('model.badges', 'user_badges'),
  actions: {
    more_results: function() {
      var _this = this;
      if(this.get('more_available')) {
        var meta = this.get('meta');
        var args = {user_id: this.get('user.id'), goal_id: this.get('model.id'), per_page: meta.per_page, offset: (meta.offset + meta.per_page)};
        var find = this.store.query('log', args);
        find.then(function(list) {
          _this.set('logs', _this.get('logs').concat(list.content.mapBy('record')));
          var meta = Ember.$.extend({}, list.meta);
          _this.set('meta', meta);
          _this.set('more_available', !!meta.next_url);
        }, function() { });
      }
    },
    new_note: function(goal) {
      var _this = this;
      modal.open('record-note', {note_type: 'text', user: this.get('user'), goal: this.get('model')}).then(function(res) {
        _this.load_logs();
      }, function() { });
    },
    quick_assessment: function(goal) {
      var _this = this;
      modal.open('quick-assessment', {user: this.get('user'), goal: this.get('model')}).then(function(res) {
        _this.load_logs();
      }, function() { });
    },
    edit_goal: function() {
      this.set('editing', true);
    },
    cancel_edit: function() {
      this.set('editing', false);
    },
    save_goal: function() {
      var _this = this;
      var goal = this.get('model');
      if(this.get('selected_goal')) {
        goal = this.store.createRecord('goal');
      }
      _this.set('saving', true);
      _this.set('error', false);
      goal.save().then(function() {
        _this.set('saving', false);
        _this.set('editing', false);
      }, function() {
        _this.set('saving', false);
        _this.set('error', true);
      });
    },
    video_ready: function(id) {
      this.set('video_pending', false);
      if(this.get('model')) {
        this.set('model.video_id', id);
      }
    },
    video_not_ready: function() {
      this.set('video_pending', false);
      if(this.get('model')) {
        this.set('model.video_id', null);
      }
    },
    video_pending: function() {
      this.set('video_pending', true);
      if(this.get('model')) {
        this.set('model.video_id', null);
      }
    },
    remove_badge: function(badge) {
      this.get('model').remove_badge(badge);
    },
    add_badge_level: function() {
      if(this.get('model')) {
        this.get('model').add_badge_level();
      }
    },
    badge_popup: function(badge) {
      if(badge.user_badge.earned) {
        modal.open('badge-awarded', {badge: badge.user_badge});
      }
    }
  }
});


