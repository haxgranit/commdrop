import Ember from 'ember';
import i18n from './i18n';
import CoughDrop from '../app';

var types = ['communicator_type', 'supporter_type', 'monthly_subscription', 'long_term_subscription',
  'monthly_3', 'monthly_4', 'monthly_5', 'monthly_6', 'monthly_7', 'monthly_8', 'monthly_9', 'monthly_10',
  'long_term_150', 'long_term_200', 'long_term_250', 'long_term_300',
  'slp_monthly_free', 'slp_monthly_3', 'slp_monthly_4', 'slp_monthly_5',
  'slp_long_term_free', 'slp_long_term_50', 'slp_long_term_100', 'slp_long_term_150',
  'subscription_amount'];
var obs_properties = [];
types.forEach(function(type) {
  obs_properties.push('subscription.' + type);
});

var obs_func = function() {
  var _this = this;
  types.forEach(function(type) {
    var res = "btn ";
    if(_this.get('subscription.' + type)) {
      res = res + "btn-primary active";
    } else {
      res = res + "btn-default";
    }
    _this.set(type + '_class', res);
  });
};

var Subscription = Ember.Object.extend({
  init: function() {
    this.reset();
  },
  reset: function() {
    this.set('user_type', 'communicator');
    this.set('subscription_type', 'monthly');
    this.set('subscription_amount', null);
    this.set('show_options', false);
    this.set('show_cancel', false);
    this.set('finalizing_purchase', false);
    this.set('purchase_complete', false);
    this.set('canceling', false);
    this.set('email', null);
    if(this.get('user')) {
      var u = this.get('user');
      var plan = u.get('subscription.plan_id');
      
      this.set('email', u.get('email'));
      
      if(u.get('preferences.role') == 'supporter') {
        this.set('user_type', 'supporter');
      } else if(['therapist', 'parent'].indexOf(u.get('preferences.registration_type')) >= 0) {
        this.set('user_type', 'supporter');
      }
      
      if(u.get('subscription.expires')) {
        var expires = window.moment(u.get('subscription.expires'));
        var now = window.moment(new Date());
        var future = window.moment(new Date()).add(30, 'day');
        if(expires < now) {
          // expired
          this.set('user_expired', true);
          this.set('show_options', true);
        } else if(expires < future) {
          // expiring soon-ish
          this.set('user_expiring', true);
          this.set('show_options', true);
        } else {
          // not expiring for a while
          this.set('user_expiring', false);
        }
      }
      if(plan) {
        if(plan.match(/^monthly/) || plan.match(/^long/)) {
          this.set('user_type', 'communicator');
        } else if(plan.match(/^eval/)) {
          this.set('eval', true);
          this.set('user_type', 'communicator');
        } else {
          this.set('user_type', 'supporter');
        }
        this.set('subscription_plan', plan);
        this.set('subscription_amount', plan);
      }
    }
    if(this.get('code')) {
      this.set('show_options', true);
      this.set('subscription_type', 'gift_code');
      this.set('gift_code', this.get('code'));
      this.set('code', null);
    }
    this.set_default_subscription_amount();
  },
  valid: function() {
    if(this.get('subscription_type') == 'gift_code') {
      return !!this.get('gift_code');
    } else if(this.get('subscription_type') == 'long_term_gift') {
      return !!(this.get('email') && ['long_term_150', 'long_term_200', 'long_term_250', 'long_term_300'].indexOf(this.get('subscription_amount')) != -1);
    } else if(this.get('user_type') == 'communicator') {
      if(this.get('subscription_type') == 'monthly') {
        return ['monthly_3', 'monthly_4', 'monthly_5', 'monthly_6', 'monthly_7', 'monthly_8', 'monthly_9', 'monthly_10'].indexOf(this.get('subscription_amount')) != -1;
      } else {
        return ['long_term_100', 'long_term_150', 'long_term_200', 'long_term_250', 'long_term_300'].indexOf(this.get('subscription_amount')) != -1;
      }
    } else {
      if(this.get('subscription_type') == 'monthly') {
        return ['slp_monthly_free', 'slp_monthly_3', 'slp_monthly_4', 'slp_monthly_5'].indexOf(this.get('subscription_amount')) != -1;
      } else {
        return ['slp_long_term_free', 'slp_long_term_50', 'slp_long_term_100', 'slp_long_term_150'].indexOf(this.get('subscription_amount')) != -1;
      }
    }
  }.property('user_type', 'subscription_type', 'subscription_amount', 'gift_code', 'email'),
  set_default_subscription_amount: function() {
    if(this.get('user_type') == 'communicator') {
      if(!this.get('subscription_amount') || !this.get('subscription_amount').match(/^(monthly_|long_term_)/)) {
        this.set('subscription_type', 'monthly');
      }
      if(this.get('subscription_type') == 'monthly') {
        if(!this.get('subscription_amount') || !this.get('subscription_amount').match(/^monthly_/)) {
          this.set('subscription_amount', 'monthly_6');
        }
      } else if(this.get('subscription_type') == 'long_term') {
        if(!this.get('subscription_amount') || !this.get('subscription_amount').match(/^long_term_/)) {
          this.set('subscription_amount', 'long_term_200');
        }
      }
    } else {
      if(!this.get('subscription_amount') || !this.get('subscription_amount').match(/^slp_/)) {
        this.set('subscription_amount', 'slp_long_term_free');
        this.set('subscription_type', 'long_term');
      }
    }
  }.observes('user_type', 'subscription_type', 'subscription_amount'),
  communicator_type: function() {
    return this.get('user_type') == 'communicator';
  }.property('user_type'),
  supporter_type: function() {
    return this.get('user_type') == 'supporter';
  }.property('user_type'),
  gift_type: function() {
    return this.get('subscription_type') == 'gift_code';
  }.property('subscription_type'),
  monthly_subscription: function() {
    return this.get('subscription_type') == 'monthly';
  }.property('subscription_type'),
  long_term_subscription: function() {
    return this.get('subscription_type') == 'long_term';
  }.property('subscription_type'),
  monthly_3: function() {
    return this.get('subscription_amount') == 'monthly_3';
  }.property('subscription_amount'),
  monthly_4: function() {
    return this.get('subscription_amount') == 'monthly_4';
  }.property('subscription_amount'),
  monthly_5: function() {
    return this.get('subscription_amount') == 'monthly_5';
  }.property('subscription_amount'),
  monthly_6: function() {
    return this.get('subscription_amount') == 'monthly_6';
  }.property('subscription_amount'),
  monthly_7: function() {
    return this.get('subscription_amount') == 'monthly_7';
  }.property('subscription_amount'),
  monthly_8: function() {
    return this.get('subscription_amount') == 'monthly_8';
  }.property('subscription_amount'),
  monthly_9: function() {
    return this.get('subscription_amount') == 'monthly_9';
  }.property('subscription_amount'),
  monthly_10: function() {
    return this.get('subscription_amount') == 'monthly_10';
  }.property('subscription_amount'),
  slp_monthly_free: function() {
    return this.get('subscription_amount') == 'slp_monthly_free';
  }.property('subscription_amount'),
  slp_monthly_3: function() {
    return this.get('subscription_amount') == 'slp_monthly_3';
  }.property('subscription_amount'),
  slp_monthly_4: function() {
    return this.get('subscription_amount') == 'slp_monthly_4';
  }.property('subscription_amount'),
  slp_monthly_5: function() {
    return this.get('subscription_amount') == 'slp_monthly_5';
  }.property('subscription_amount'),
  long_term_100: function() {
    return this.get('subscription_amount') == 'long_term_100';
  }.property('subscription_amount'),
  long_term_150: function() {
    return this.get('subscription_amount') == 'long_term_150';
  }.property('subscription_amount'),
  long_term_200: function() {
    return this.get('subscription_amount') == 'long_term_200';
  }.property('subscription_amount'),
  long_term_250: function() {
    return this.get('subscription_amount') == 'long_term_250';
  }.property('subscription_amount'),
  long_term_300: function() {
    return this.get('subscription_amount') == 'long_term_300';
  }.property('subscription_amount'),
  slp_long_term_free: function() {
    return this.get('subscription_amount') == 'slp_long_term_free';
  }.property('subscription_amount'),
  slp_long_term_50: function() {
    return this.get('subscription_amount') == 'slp_long_term_50';
  }.property('subscription_amount'),
  slp_long_term_100: function() {
    return this.get('subscription_amount') == 'slp_long_term_100';
  }.property('subscription_amount'),
  slp_long_term_150: function() {
    return this.get('subscription_amount') == 'slp_long_term_150';
  }.property('subscription_amount'),
  amount_in_cents: function() {
    if(this.get('valid')) {
      var num = this.get('subscription_amount').split(/_/).pop();
      if(num == 'free') {
        return 0;
      } else {
        return parseInt(num, 10) * 100;
      }
    } else {
      return null;
    }
  }.property('subscription_amount', 'valid'),
  description: function() {
    if(this.get('user_type') == 'communicator') {
      if(this.get('eval')) {
        if(this.get('subscription_type') == 'monthly') {
          return i18n.t('monthly_sub', "CoughDrop monthly evaluation account");
        } else {
          return i18n.t('long_term_sub', "CoughDrop evaluation account");
        }
      } else {
        if(this.get('subscription_type') == 'monthly') {
          return i18n.t('monthly_sub', "CoughDrop monthly subscription");
        } else {
          return i18n.t('long_term_sub', "CoughDrop 5-year purchase");
        }
      }
    } else {
      if(this.get('subscription_type') == 'monthly') {
        return i18n.t('slp_monthly_sub', "CoughDrop supporting-role monthly subscription");
      } else {
        return i18n.t('slp_long_term_sub', "CoughDrop supporting-role 5-year purchase");
      }
    }
  }.property('user_type', 'subscription_type'),
  subscription_plan_description: function() {
    var plan = this.get('subscription_plan');
    if(!plan) {
      if(this.get('user.subscription.never_expires')) {
        return "free forever";
      } else {
        return "no plan"; 
      }
    }
    var pieces = plan.split(/_/);
    var amount = pieces.pop();
    if(amount != 'free') { amount = '$' + amount; }
    var type = "communicator ";
    if(plan.match(/^slp_/)) {
      type = "supporter ";
    } else if(plan.match(/^eval_/)) {
      type = "eval device ";
    }
    var schedule = "monthly ";
    if(plan.match(/long_term/)) {
      schedule = "long-term ";
    }
    return type + schedule + amount;
  }.property('subscription_plan', 'user.subscription.never_expires'),
  purchase_description: function() {
    if(this.get('subscription_type') == 'monthly') {
      return i18n.t('subscribe', "Subscribe");
    } else {
      return i18n.t('purchase', "Purchase");
    }
  }.property('subscription_type')
});

Subscription.reopenClass({
  obs_func: obs_func,
  obs_properties: obs_properties,
  init: function() {
    if(window.StripeCheckout) { return; }
    var $div = Ember.$("<div/>", {id: 'stripe_script'});
    var script = document.createElement('script');
    script.src = 'https://checkout.stripe.com/checkout.js';
    $div.append(script);
    var config = document.createElement('script');
    document.body.appendChild($div[0]);
    
    var check_for_ready = function() {
      if(window.StripeCheckout) {
        Subscription.handler = window.StripeCheckout.configure({
          key: window.stripe_public_key,
          image: '/images/logo-big.png',
          token: function(result) {
            Subscription.handler.defer.resolve(result);
          }
        });
        Subscription.ready = true;
      } else {
        setTimeout(check_for_ready, 500);
      }
    };
    
    check_for_ready();
  },
  purchase: function(subscription) {
    if(!window.StripeCheckout || !Subscription.handler) { 
      alert('not ready'); 
      return Ember.RSVP.reject({error: "not ready"});
    }
    if(subscription.get('subscription_amount').match(/free/)) {
      return Ember.RSVP.resolve({id: 'free'});
    }
    var defer = Ember.RSVP.defer();
    Subscription.handler.open({
      name: "CoughDrop",
      description: subscription.get('description'),
      amount: subscription.get('amount_in_cents'),
      panelLabel: subscription.get('purchase_description'),
      email: subscription.get('user.email'),
      zipCode: true
    });
    Subscription.handler.defer = defer;
    return defer.promise;
  }
});

export default Subscription;