import Ember from 'ember';
import Subscription from '../utils/subscription';
import modal from '../utils/modal';
import persistence from '../utils/persistence';
import progress_tracker from '../utils/progress_tracker';
import app_state from '../utils/app_state';
import i18n from '../utils/i18n';

export default Ember.Component.extend({
  update_classes: Subscription.obs_func.observes.apply(Subscription.obs_func, Subscription.obs_properties),
  didInsertElement: function() {
    if(this.$().width() < 850) {
      this.$().addClass('skinny_subscription');
    }
    this.update_classes();
  },
  actions: {
    toggle_explanation: function(type) {
      this.set('explanation_' + type, !this.get('explanation_' + type));
    },
    show_expiration_notes: function() {
      this.set('show_expiration_notes', true);
    },
    skip_subscription: function() {
      var role = this.get('subscription.user_type');
      var user = this.get('user');
      user.set('preferences.role', role);
      var progress = user.get('preferences.progress') || {};
      progress.skipped_subscribe_modal = true;
      user.set('preferences.progress', progress);
      user.save().then(null, function() { });
      // TODO: this really belongs in the modal controller
      this.sendAction('subscription_skip');
    },
    reload: function() {
      location.reload();
    },
    reset: function() {
      this.get('subscription').reset();
    },
    set_user_type: function(type) {
      this.set('subscription.user_type', type);
    },
    set_subscription_type: function(type) {
      this.set('subscription.subscription_type', type);
    },
    set_special_subscription: function() {
      this.set('subscription.special_type', !this.get('subscription.special_type'));
    },
    set_subscription: function(amount) {
      this.set('subscription.subscription_amount', amount);
    },
    show_options: function() {
      this.set('subscription.show_options', true);
      this.set('subscription.show_cancel', false);
    },
    purchase: function() {
      var subscription = this.get('subscription');
      var user = this.get('user');
      if(!Subscription.ready || !subscription || !user) {
        modal.error(i18n.t('purchasing_not_read', "There was a problem initializing the purchasing system. Please contact support."));
        return;
      } else if(!subscription.get('valid')) {
        return;
      }
      var _this = this;
      var subscribe = function(token, type) {
        subscription.set('finalizing_purchase', true);
        persistence.ajax('/api/v1/users/' + user.get('user_name') + '/subscription', {
          type: 'POST',
          data: {
            token: token,
            type: type
          }
        }).then(function(data) {
          progress_tracker.track(data.progress, function(event) {
            if(event.status == 'errored') {
              _this.sendAction('subscription_error', i18n.t('user_subscription_update_failed', "Subscription failed. Please try again or contact support for help."));
              _this.send('reset');
              console.log(event);
              if(event.sub_status == 'server_unresponsive') {
                console.error('purchase_server_timeout');
              } else {
                console.error('purchase_progress_failed');
              }
            } else if(event.status == 'finished') {
              user.reload().then(function() {
                user.set('preferences.progress.subscription_set', true);
                user.save();
                _this.send('reset');
                _this.sendAction('subscription_success', i18n.t('user_subscribed', "Your subscription succeeded! Thank you for supporting CoughDrop!"));
              }, function() {
                _this.sendAction('subscription_user_error', i18n.t('user_subscription_reload_failed', "There was a problem reloading your user account. Please try loading this page again."));
              });
            }
          });
        }, function(err) {
          console.log(err);
          console.error('purchase_subscription_start_failed');
          _this.send('reset');
          _this.sendAction('subscription_error', i18n.t('user_subscription_update_failed', "Subscription failed unexpectedly. Please contact support for help."));
        });
      };
      
      if(subscription.get('gift_type')) {
        subscribe({code: subscription.get('gift_code')}, 'gift_code');
      } else {
        Subscription.purchase(subscription).then(function(result) {
          subscribe(result, subscription.get('subscription_amount_plus_trial'));
        }, function() {
          modal.error(i18n.t('purchasing_not_completed', "There was an unexpected problem completing your purchase"));
          console.error('purchase_promise_rejected');
        });
      }
    }
  }
});
