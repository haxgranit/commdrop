import Ember from 'ember';
import CoughDrop from '../../app';
import modal from '../../utils/modal';
import Utils from '../../utils/misc';
import i18n from '../../utils/i18n';
import progress_tracker from '../../utils/progress_tracker';
import persistence from '../../utils/persistence';

export default Ember.Controller.extend({
  registration_types: CoughDrop.registrationTypes,
  allow_shares_options: [
    {name: i18n.t('email_shares', "Email Me When People I Supervise Share a Message with Me"), id: 'email'},
    {name: i18n.t('text_shares', "Text Me When People I Supervise Share a Message with Me"), id: 'text'},
    {name: i18n.t('app_shares', "Show In the App When People I Supervise Share a Message with Me"), id: 'app'}
  ],
  notification_frequency_options: [
    {name: i18n.t('no_notifications', "Don't Email Me Communicator Reports"), id: ''},
    {name: i18n.t('weekly_notifications', "Email Me Weekly Communicator Reports"), id: '1_week'},
    {name: i18n.t('text_shares', "Email Me Communicator Reports Every Two Weeks"), id: '2_weeks'},
    {name: i18n.t('app_shares', "Email Me Monthly Communicator Reports"), id: '1_month'}
  ],
  title: function() {
    return "Edit " + this.get('model.user_name');
  }.property('model.user_name'),
  load_webhooks: function() {
    var _this = this;
    _this.set('webhooks', {loading: true});
    Utils.all_pages('webhook', {user_id: this.get('model.id')}, function(partial) {
    }).then(function(res) {
      _this.set('webhooks', res);
    }, function(err) {
      _this.set('webhooks', {error: true});
    });
  },
  load_integrations: function() {
    var _this = this;
    _this.set('integrations', {loading: true});
    Utils.all_pages('integration', {user_id: this.get('model.id')}, function(partial) {
    }).then(function(res) {
      _this.set('integrations', res);
    }, function(err) {
      _this.set('integrations', {error: true});
    });
  },
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
    },
    manage_connections: function() {
      this.set('managing_connections', !this.get('managing_connections'));
      if(this.get('managing_connections')) {
        this.load_webhooks();
        this.load_integrations();
      }
    },
    add_webhook: function() {
      var _this = this;
      modal.open('add-webhook', {user: this.get('model')}).then(function(res) {
        if(res && res.created) {
          _this.load_webhooks();
        }
      });
    },
    delete_webhook: function(webhook) {
      var _this = this;
      modal.open('confirm-delete-webhook', {user: this.get('model'), webhook: webhook}).then(function(res) {
        if(res && res.deleted) {
          _this.load_webhooks();
        }
      });
    },
    test_webhook: function(webhook) {
      modal.open('test-webhook', {user: this.get('model'), webhook: webhook});
    },
    add_integration: function() {
      var _this = this;
      modal.open('add-integration', {user: this.get('model')}).then(function(res) {
        if(res && res.created) {
          _this.load_integrations();
        }
      });
    },
    delete_integration: function(integration) {
      var _this = this;
      modal.open('confirm-delete-integration', {user: this.get('model'), integration: integration}).then(function(res) {
        if(res && res.deleted) {
          _this.load_integrations();
        }
      });
    }
  }
});
