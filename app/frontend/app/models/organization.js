import Ember from 'ember';
import DS from 'ember-data';
import CoughDrop from '../app';
import i18n from '../utils/i18n';
import persistence from '../utils/persistence';
import modal from '../utils/modal';

CoughDrop.Organization = DS.Model.extend({
  didLoad: function() {
    this.set('total_licenses', this.get('allotted_licenses'));
  },
  didUpdate: function() {
    this.set('total_licenses', this.get('allotted_licenses'));
  },
  name: DS.attr('string'),
  permissions: DS.attr('raw'),
  admin: DS.attr('boolean'),
  allotted_licenses: DS.attr('number'),
  used_licenses: DS.attr('number'),
  total_users: DS.attr('number'),
  total_managers: DS.attr('number'),
  total_supervisors: DS.attr('number'),
  created: DS.attr('date'),
  management_action: DS.attr('string'),
  recent_session_user_count: DS.attr('number'),
  recent_session_count: DS.attr('number'),
  licenses_available: function() {
    return (this.get('total_licenses') || 0) > (this.get('used_licenses') || 0);
  }.property('total_licenses', 'used_licenses')
});
CoughDrop.Organization.reopenClass({
  mimic_server_processing: function(record, hash) {
    hash.organization.permissions = {
      "view": true,
      "edit": true
    };

    return hash;
  }
});

export default CoughDrop.Organization;
