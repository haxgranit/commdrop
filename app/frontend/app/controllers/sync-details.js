import Ember from 'ember';
import modal from '../utils/modal';

export default modal.ModalController.extend({
  opening: function() {
    var details = this.get('model.details');
    (details || []).forEach(function(sync) {
      Ember.set(sync, 'cached', sync.statuses.filter(function(s) { return s.status == 'cached'; }).length);
      Ember.set(sync, 'downloaded', sync.statuses.filter(function(s) { return s.status == 'downloaded'; }).length);
      Ember.set(sync, 're_downloaded', sync.statuses.filter(function(s) { return s.status == 're-downloaded'; }).length);
      sync.statuses.forEach(function(s) {
        Ember.set(s, s.status.replace(/-/, '_'), true);
      });
    });
  },
  actions: {
    toggle_statuses: function(sync) {
      Ember.set(sync, 'toggled', !Ember.get(sync, 'toggled'));
    }
  }
});
