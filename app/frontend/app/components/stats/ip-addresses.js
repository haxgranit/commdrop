import Ember from 'ember';

export default Ember.Component.extend({
  actions: {
    filter: function(ip) {
      this.sendAction('filter', 'location', ip.id);
    }
  }
});
