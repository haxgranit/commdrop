import Ember from 'ember';
import i18n from '../../utils/i18n';

export default Ember.Route.extend({
  model: function() {
    var user = this.modelFor('user');
    user.set('subroute_name', i18n.t('goals', 'goals'));
    return user;
  },
  setupController: function(controller, model) {
    controller.set('model', model);
  }
});
