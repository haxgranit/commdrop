import Ember from 'ember';

export default Ember.Component.extend({
  actions: {
    word_cloud: function() {
      this.sendAction('word_cloud');
    }
  }
});
