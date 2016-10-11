import Ember from 'ember';
import persistence from '../../utils/persistence';
import modal from '../../utils/modal';
import i18n from '../../utils/i18n';
import CoughDrop from '../../app';

export default Ember.Controller.extend({
  load_goals: function() {
    var _this = this;
    _this.set('goals', {loading: true});
    CoughDrop.store.query('goal', {template_header: true}).then(function(data) {
      _this.set('goals', data.content.mapBy('record'));
      _this.set('goals.meta', data.meta);
    }, function(err) {
      _this.set('goals', {error: true});
    });
  },
  actions: {
    new_goal: function() {
      var goal = CoughDrop.store.createRecord('goal');
      goal.set('template_header', true);
      this.set('new_goal', goal);
    },
    save_goal: function() {
      var goal = this.get('new_goal');
      var _this = this;
      _this.set('status', {saving: true});
      goal.save().then(function(goal) {
        _this.set('new_goal', null);
        _this.transitionToRoute('goals.goal', goal.get('id'));
      }, function(err) {
        _this.set('status', {error: true});
      });
    },
    cancel_new: function() {
      this.set('new_goal', null);
    }
  }
});
