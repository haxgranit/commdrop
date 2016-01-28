import Ember from 'ember';
import app_state from '../../utils/app_state';

export default Ember.Component.extend({
  actions: {
    compare_to: function() {
      this.sendAction('compare_to');
    },
    clear_side: function() {
      this.sendAction('clear_side');
    },
    update_filter: function(type) {
      this.sendAction('update_filter', type);
    }
  }
});
