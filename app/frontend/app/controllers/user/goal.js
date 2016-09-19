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
      modal.open('record-note', {type: 'text', user: this.get('user'), goal: this.get('model')}).then(function(res) {
        _this.load_logs();
      }, function() { });
    },
    quick_assessment: function(goal) {
      var _this = this;
      modal.open('quick-assessment', {user: this.get('user'), goal: this.get('model')}).then(function(res) {
        _this.load_logs();
      }, function() { });
    }
  }
});


