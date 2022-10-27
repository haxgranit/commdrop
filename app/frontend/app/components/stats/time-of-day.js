import Ember from 'ember';
import Component from '@ember/component';
import { later as runLater } from '@ember/runloop';
import $ from 'jquery';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';
import { htmlSafe } from '@ember/string';

export default Component.extend({
  didInsertElement: function() {
    this.draw();
  },
  elem_class: function() {
    if(this.get('side_by_side')) {
      return htmlSafe('col-sm-6');
    } else {
      return htmlSafe('col-sm-8');
    }
  }.property('side_by_side'),
  elem_style: function() {
    if(this.get('right_side')) {
      return htmlSafe('border-left: 1px solid #eee;');
    } else {
      return htmlSafe('');
    }
  }.property('right_side'),
  draw: function() {
    var $elem = $(this.get('element'));
    if(this.get('ref_stats') && this.get('usage_stats')) {
      this.set('usage_stats.ref_max_time_block', this.get('ref_stats.max_time_block'));
      this.set('usage_stats.ref_max_combined_time_block', this.get('ref_stats.max_combined_time_block'));
      this.set('usage_stats.ref_max_modeled_time_block', this.get('ref_stats.max_modeled_time_block'));
      this.set('usage_stats.ref_max_combined_modeled_time_block', this.get('ref_stats.max_combined_modeled_time_block'));
    }
    runLater(function() {
      $elem.find(".time_block").tooltip({container: 'body'});
    }, 1000);
  }.observes('usage_stats.draw_id', 'ref_stats.draw_id', 'usage_stats.modeling')
});

