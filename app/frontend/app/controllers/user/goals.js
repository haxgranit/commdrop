import Ember from 'ember';
import modal from '../../utils/modal';
import CoughDrop from '../../app';
import app_state from '../../utils/app_state';

export default Ember.Controller.extend({
  load_goals: function() {
    var controller = this;
    controller.set('goals', {loading: true});
    this.store.query('goal', {user_id: this.get('model.id')}).then(function(list) {
      controller.set('goals', {list: list.content.mapBy('record')});
    }, function() {
      controller.set('goals', {error: true});
    });
  },
  any_goal: function() {
    return this.get('primary_goal') || this.get('secondary_goals').length > 0 || this.get('past_goals').length > 0;
  }.property('primary_goal', 'secondary_goals', 'past_goals'),
  primary_goal: function() {
    return (this.get('goals.list') || []).find(function(g) { return g.get('active') && g.get('primary'); });
  }.property('goals.list'),
  secondary_goals: function() {
    var pg_id = this.get('primary_goal.id');
    return (this.get('goals.list') || []).filter(function(g) { return g.get('active') && g.get('id') != pg_id; });
  }.property('primary_goal.id', 'goals.list'),
  past_goals: function() {
    return (this.get('goals.list') || []).filter(function(g) { return !g.get('active'); });
  }.property('goals.list'),
  actions: {
    add_goal: function() {
      var _this = this;
      modal.open('new-goal', {user: this.get('model') }).then(function(res) {
        if(res) {
          _this.load_goals();
        }
      }, function() { });
    },
    new_note: function(goal) {
      var _this = this;
      modal.open('record-note', {note_type: 'text', user: this.get('model'), goal: goal}).then(function(res) {
      }, function() { });
    },
    quick_assessment: function(goal) {
      var _this = this;
      modal.open('quick-assessment', {user: this.get('model'), goal: goal}).then(function(res) {
      }, function() { });
    },
    update: function(goal, attribute, action) {
      var done = Ember.RSVP.resolve();
      if(attribute == 'primary') {
        goal.set('primary', action == 'on');
        done = goal.save();
      } else if(attribute == 'active') {
        goal.set('active', action == 'on');
        done = goal.save();
      }
      var _this = this;
      done.then(function() {
        _this.load_goals();
      }, function() { });
    },
    delete: function(goal) {
      var _this = this;
      modal.open('confirm-delete-goal', {user: this.get('model'), goal: goal}).then(function(res) {
        if(res.updated) {
          _this.load_goals();
        }
      });
    },
    find_goal: function() {
      var _this = this;
      modal.open('new-goal', {browse: true, user: this.get('model') }).then(function(res) {
        if(res) {
          _this.load_goals();
        }
      }, function() { });
    }
  }
});
