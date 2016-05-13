import Ember from 'ember';
import i18n from '../../utils/i18n';

export default Ember.Route.extend({
  model: function(params) {
    var user = this.modelFor('user');
    user.set('subroute_name', i18n.t('goals', 'goals'));
    return this.store.findRecord('goal', params.goal_id);
  },
  setupController: function(controller, model) {
    if(!model.get('permissions')) {
      model.reload();
    }
    controller.set('model', model);
  }
});
