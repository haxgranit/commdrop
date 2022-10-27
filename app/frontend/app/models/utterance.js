import Ember from 'ember';
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
  show_user: DS.attr('boolean'),
  best_image_url: function() {
    return this.get('large_image_url') || this.get('image_url');
  }.property('image_url', 'large_image_url'),
  check_for_large_image_url: function() {
    var attempt = this.get('large_image_attempt') || 1;
    var _this = this;
    if(_this.get('permissions.edit') && !_this.get('large_image_url') && attempt < 15) {
      Ember.run.later(function() {
        _this.set('large_image_attempt', attempt + 1);
        _this.reload().then(function(u) {
          _this.check_for_large_image_url();
        });
      }, attempt * 500);
    }
  },
});

export default CoughDrop.Utterance;
