import Ember from 'ember';
import CoughDrop from '../app';
import modal from '../utils/modal';
import i18n from '../utils/i18n';
import app_state from '../utils/app_state';

export default modal.ModalController.extend({
  opening: function() {
    var user = CoughDrop.store.createRecord('user', {
      preferences: {
        registration_type: 'manually-added-org-user'
      },
      authored_organization_id: this.get('model.organization_id'),
      org_management_action: 'add_manager'
    });
    this.set('linking', false);
    this.set('error', null);
    user.set('watch_user_name', true);
    this.set('model.user', user);
    this.set('model.user.org_management_action', this.get('model.default_org_management_action'));
  },
  user_types: function() {
    return [
      {id: '', name: i18n.t('select_user_type', "[ Add This User As ]")},
      {id: 'add_user', name: i18n.t('add_sponsored_used', "Add this User As a Sponsored Communicator")},
      {id: 'add_unsponsored_user', name: i18n.t('add_unsponsored_used', "Add this User As an Unsponsored Communicator")},
      {id: 'add_supervisor', name: i18n.t('add_supervisor', "Add this User As a Supervisor")},
      {id: 'add_manager', name: i18n.t('add_manager', "Add this User As a Full Manager")},
      {id: 'add_assistant', name: i18n.t('add_assistant', "Add this User As a Management Assistant")},
    ];
  }.property(),
  actions: {
    add: function() {
      var controller = this;
      controller.set('linking', true);

      var user = this.get('model.user');
      user.set('watch_user_name', false);
      var get_user_name = user.save().then(function(user) {
        return user.get('user_name');
      }, function() {
        return Ember.RSVP.reject(i18n.t('creating_user_failed', "Failed to create a new user with the given settings"));
      });

      var action = user.get('org_management_action');
      get_user_name.then(function(user_name) {
        var user = controller.get('model.user');
        user.set('org_management_action', action);
        modal.close({
          created: true,
          user: user
        });
      }, function(err) {
          controller.set('linking', false);
          controller.set('error', err);
      });
    }
  }
});
