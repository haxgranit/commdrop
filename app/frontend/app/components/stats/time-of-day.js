import Ember from 'ember';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({ 
  didInsertElement: function() {
    this.draw();
  },
  draw: function() {
    var $elem = Ember.$(this.get('element'));
    this.set('usage_stats.ref_max_time_block', this.get('ref_stats.max_time_block'));
    $elem.find(".time_block").tooltip({container: 'body'});
  }.observes('usage_stats.draw_id', 'ref_stats.draw_id')
});

