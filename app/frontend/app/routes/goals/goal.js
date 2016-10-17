import Ember from 'ember';
import persistence from '../../utils/persistence';

export default Ember.Route.extend({
  model: function(params) {
    var obj = this.store.findRecord('goal', params.goal_id);
    return obj.then(function(data) {
      if(!data.get('permissions') && persistence.get('online')) {
        Ember.run.later(function() {
          data.rollbackAttributes();
          data.reload();
        });
      }
      return data;
    });
  },
  setupController: function(controller, model) {
    var _this = this;
    controller.set('model', model);
    controller.set('status', null);
  }
});
