import Ember from 'ember';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({
  elem_style: function() {
    if(this.get('right_side')) {
      return Ember.String.htmlSafe('border-left: 1px solid #eee;');
    } else {
      return Ember.String.htmlSafe('');
    }
  }.property('right_side'),
});
