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
      modal.open('record-note', {type: 'text', user: this.get('model'), goal: goal}).then(function(res) {
      }, function() { });
    },
    quick_assessment: function(goal) {
      var _this = this;
      modal.open('quick-assessment', {user: this.get('model'), goal: goal}).then(function(res) {
      }, function() { });
    },
    update: function(goal, attribute, action) {
    },
    delete: function(goal) {
    }
  }
});
