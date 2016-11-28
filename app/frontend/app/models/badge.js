import Ember from 'ember';
import DS from 'ember-data';
import CoughDrop from '../app';

CoughDrop.Badge = DS.Model.extend({
  name: DS.attr('string'),
  highlighted: DS.attr('boolean'),
  disabled: DS.attr('boolean'),
  global: DS.attr('boolean'),
  image_url: DS.attr('string'),
  level: DS.attr('number'),
  goal_id: DS.attr('string'),
  max_level: DS.attr('boolean'),
  progress: DS.attr('number'),
  earned: DS.attr('date'),
  started: DS.attr('date'),
  ended: DS.attr('date'),
  progress_out_of_100: function() {
    return Math.min(Math.max(this.get('progress') || 0, 0) * 100, 100);
  }.property('progress'),
  progress_style: function() {
    return "width: " + Math.min(Math.max((this.get('progress') || 0) * 100, 0), 100) + "%";
  }.property('progress')
});


export default CoughDrop.Badge;
