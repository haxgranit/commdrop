import Ember from 'ember';
import DS from 'ember-data';
import CoughDrop from '../app';

CoughDrop.Goal = DS.Model.extend({
  user_id: DS.attr('string'),
  video_id: DS.attr('string'),
  has_video: DS.attr('boolean'),
  primary: DS.attr('boolean'),
  active: DS.attr('boolean'),
  primary: DS.attr('boolean'),
  template: DS.attr('boolean'),
  template_header: DS.attr('boolean'),
  summary: DS.attr('string'),
  description: DS.attr('string'),
  permissions: DS.attr('raw'),
  video: DS.attr('raw'),
  user: DS.attr('raw'),
  author: DS.attr('raw'),
  comments: DS.attr('raw'),
  started: DS.attr('date'),
  ended: DS.attr('date')
});

export default CoughDrop.Goal;
