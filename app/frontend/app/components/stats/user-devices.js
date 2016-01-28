import Ember from 'ember';

export default Ember.Component.extend({
  actions: {
    filter: function(device) {
      this.sendAction('filter', 'device', device.id);
    }
  }
});
