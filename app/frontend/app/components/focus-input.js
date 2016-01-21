import Ember from 'ember';
import capabilities from '../utils/capabilities';

export default Ember.TextField.extend({
  becomeFocused: function() {
    if(!capabilities.mobile) {
      this.$().focus().select();
    }
  }.on('didInsertElement'),
  focusOut: function() {
    this.sendAction();
  }
});