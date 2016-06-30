import Ember from 'ember';
import i18n from '../../utils/i18n';
import Utils from '../../utils/misc';
import persistence from '../../utils/persistence';
import modal from '../../utils/modal';

export default Ember.Controller.extend({
  refresh_units: function() {
    var _this = this;
    this.set('units', {loading: true});
    Utils.all_pages('unit', {organization_id: this.get('model.id')}, function(list) {
      _this.set('units', list);
    }).then(function(data) {
      _this.set('units', data);
    }, function() {
      _this.set('units', {error: true});
    });
  },
  load_users: function() {
    var _this = this;
    Utils.all_pages('/api/v1/organizations/' + this.get('model.id') + '/users', {result_type: 'user', type: 'GET', data: {recent: true}}).then(function(data) {
      _this.set('all_communicators', data.filter(function(u) { return !u.org_pending; });
    }, function(err) {
      _this.set('user_error', true);
    });
    Utils.all_pages('/api/v1/organizations/' + this.get('model.id') + '/supervisors', {result_type: 'user', type: 'GET', data: {recent: true}}).then(function(data) {
      _this.set('all_supervisors', data);
    }, function(err) {
      _this.set('user_error', true);
    });
  },
  supervisor_options: function() {
    var res = [{
      id: null,
      name: i18n.t('select_user', "[ Select User ]")
    }];
    (this.get('all_supervisors') || []).forEach(function(sup) {
      res.push({
        id: sup.id,
        name: sup.user_name
      });
    });
    return res;
  }.property('all_supervisors'),
  communicator_options: function() {
    var res = [{
      id: null,
      name: i18n.t('select_user', "[ Select User ]")
    }];
    (this.get('all_communicators') || []).forEach(function(sup) {
      res.push({
        id: sup.id,
        name: sup.user_name
      });
    });
    return res;
  }.property('all_communicators'),
  reorder_units: function(unit_ids) {
  },
  actions: {
    add_unit: function() {
      var name = this.get('new_unit_name');
      var _this = this;
      this.set('new_unit_name', null);
      if(name) {
        var unit = this.store.createRecord('unit', {name: name, organization_id: this.get('model.id')});
        unit.save().then(function() {
          _this.refresh_units();
        }, function() {
          modal.error(i18n.t('room_not_created', "There was an unexpected error creating the new room"));
        });
      }
    },
    delete_unit: function(unit) {
      var _this = this;
      modal.open('confirm-delete-unit', {unit: unit}).then(function(res) {
        if(res && res.deleted) {
          _this.refresh_units();
        }
      });
    },
    edit_unit: function(unit) {
      var _this = this;
      modal.open('edit-unit', {unit: unit}).then(function(res) {
        if(res && res.updated) {
          _this.refresh_units();
        }
      });
    },
    add_users: function(unit) {
      unit.set('adding_users', !unit.get('adding_users'));
    },
    add_unit_user: function(unit, user_type) {
      var action = 'add_' + user_type;
      var user_name = null;
      if(user_type.match('communicator')) {
        user_name = unit.get('communicator_user_name');
      } else {
        user_name = unit.get('supervisor_user_name');
      }
      if(!user_name) { return; }
      action = action + "-" + user_name;
      unit.set('management_action', action);
      unit.save().then(function() {
        unit.set('communicator_user_name', null);
        unit.set('supervisor_user_name', null);
      }, function() {
        modal.error(i18n.t('error_adding_user', "There was an unexpected error while trying to add the user"));
      });
    },
    delete_unit_user: function(unit, user_type, user_id) {
      var action = 'remove_' + user_type + '-' + user_id;
      unit.set('management_action', action);
      unit.save().then(function() {
      }, function() {
        modal.error(i18n.t('error_adding_user', "There was an unexpected error while trying to remove the user"));
      });
    },
    move_up: function(unit) {
    },
    move_down: function(unit) {
    }
  }
});
