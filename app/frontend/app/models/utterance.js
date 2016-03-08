import DS from 'ember-data';
import CoughDrop from '../app';

CoughDrop.Utterance = DS.Model.extend({
  button_list: DS.attr('raw'),
  sentence: DS.attr('string'),
  link: DS.attr('string'),
  image_url: DS.attr('string'),
  large_image_url: DS.attr('string'),
  permissions: DS.attr('raw'),
  user: DS.attr('raw'),
  show_user: DS.attr('boolean')
});

export default CoughDrop.Utterance;
