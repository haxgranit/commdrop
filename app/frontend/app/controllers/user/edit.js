import Ember from 'ember';
import CoughDrop from '../../app';
import modal from '../../utils/modal';
import i18n from '../../utils/i18n';

export default Ember.Controller.extend({
  registration_types: CoughDrop.registrationTypes,
  title: function() {
    return "Edit " + this.get('model.user_name');
  }.property('model.user_name'),
  actions: {
    pick_avatar: function() {
      modal.open('pick-avatar', {user: this.get('model')});
    },
    enable_change_password: function() {
      this.set('change_password', true);
    },
    saveProfile: function() {
      // TODO: add a "save pending..." status somewhere
      var user = this.get('model');
      user.set('preferences.progress.profile_edited', true);
      var _this = this;
      user.save().then(function(user) {
        user.set('password', null);
        _this.transitionToRoute('user', user.get('user_name'));
      }, function(err) {
        if(err.responseJSON && err.responseJSON.errors && err.responseJSON.errors[0] == "incorrect current password") {
          modal.error(i18n.t('incorrect_password', "Incorrect current password"));
        } else {
          modal.error(i18n.t('save_failed', "Save failed."));
        }
        
      });
    },
    cancelSave: function() {
      var user = this.get('model');
      user.rollbackAttributes();
      this.transitionToRoute('user', user.get('user_name'));
    }
  }
});