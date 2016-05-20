import Ember from 'ember';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({
  didInsertElement: function() {
    this.draw();
  },
  draw: function() {
    var $elem = Ember.$(this.get('element'));
    $elem.find(".time_block,.time_block_left").tooltip({container: 'body'});
  }.observes('goal.draw_id')
});

