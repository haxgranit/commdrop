import Ember from 'ember';
import persistence from '../utils/persistence';
import CoughDrop from '../app';

export default Ember.Route.extend({
  model: function() {
    var res = this.store.createRecord('user', {preferences: {}, referrer: CoughDrop.referrer, ad_referrer: CoughDrop.ad_referrer});
    res.set('watch_user_name', true);
    return res;
  },
  setupController: function(controller, model) {
    controller.set('model', model);
  },
  actions: {
    saveProfile: function() {
      // TODO: add a "save pending..." status somewhere
      var controller = this.get('controller');
      var user = controller.get('model');
      controller.set('triedToSave', true);
      if(!user.get('terms_agree')) { return; }
      if(controller.get('badEmail') || controller.get('passwordMismatch') || controller.get('shortPassword') || controller.get('noName')|| controller.get('noSpacesName')) { 
        return;
      }
      var _this = this;
      user.save().then(function(user) {
        user.set('password', null);
        _this.transitionTo('index');
        var meta = persistence.meta('user', null);
        if(meta && meta.access_token) {
          _this.get('session').override(meta);
        }
      }, function() { });
    }
  }
});
