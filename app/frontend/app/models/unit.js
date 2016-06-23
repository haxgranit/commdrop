import Ember from 'ember';
import DS from 'ember-data';
import CoughDrop from '../app';
import speecher from '../utils/speecher';
import persistence from '../utils/persistence';
import Utils from '../utils/misc';

CoughDrop.Unit = DS.Model.extend({
  settings: DS.attr('raw'),
  organization_id: DS.attr('string'),
  name: DS.attr('string'),
  management_action: DS.attr('string'),
  supervisors: DS.attr('raw'),
  communicators: DS.attr('raw'),
  supervisor_count: function() {
    return (this.get('supervisors') || []).length;
  }.property('supervisors'),
  communicator_count: function() {
    return (this.get('communicators') || []).length;
  }.property('communicators')
});

export default CoughDrop.Unit;
