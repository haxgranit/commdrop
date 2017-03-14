import Ember from 'ember';
import Subscription from '../../utils/subscription';
import persistence from '../../utils/persistence';
import i18n from '../../utils/i18n';

export default Ember.Route.extend({
  model: function() {
    var user = this.modelFor('user');
    user.set('subroute_name', i18n.t('subscription', 'subscription'));
    return user;
  },
  setupController: function(controller, model) {
    controller.set('model', model);
    if(!model.get('permissions.edit') && controller.get('confirmation')) {
      controller.set('subscription', {loading: true});
      persistence.ajax('/api/v1/users/' + model.get('user_name') + '?confirmation=' + controller.get('confirmation'), {type: 'GET'}).then(function(res) {
        if(res.user && res.user.subscription) {
          model.set('subscription', res.user.subscription);
          controller.set('subscription', Subscription.create({user: model, code: controller.get('code')}));
          controller.set('subscription.confirmation', controller.get('confirmation'));
        } else {
          controller.set('subscription', {error: true});
        }
      }, function(err) {
        controller.set('subscription', {error: true});
      });
    } else {
      controller.set('subscription', Subscription.create({user: model, code: controller.get('code')}));
    }
    Subscription.init();
  }
});
