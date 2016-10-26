import Ember from 'ember';
import Subscription from '../../utils/subscription';
import i18n from '../../utils/i18n';

export default Ember.Route.extend({
  model: function() {
    var user = this.modelFor('user');
    user.set('subroute_name', i18n.t('subscription', 'subscription'));
    return user;
  },
  setupController: function(controller, model) {
    controller.set('model', model);
    controller.set('subscription', Subscription.create({user: model, code: controller.get('code')}));
    Subscription.init();
  }
});
