import Ember from 'ember';
import modal from '../utils/modal';

export default modal.ModalController.extend({
  opening: function() {
    this.set('model', this.get('model.user'));
  },
  actions: {
    close: function() {
      modal.close();
    },
    remove_supervisor: function(id) {
      var user = this.get('model');
      user.set('supervisor_key', "remove_supervisor-" + id);
      user.save().then(null, function() {
        alert("sadness!");
      });
    },
    remove_supervision: function(id) {
      var user = this.get('model');
      user.set('supervisor_key', "remove_supervision-" + id);
      user.save().then(null, function() {
        alert("sadness!");
      });
    },
    remove_supervisee: function(id) {
      var user = this.get('model');
      user.set('supervisor_key', "remove_supervisee-" + id);
      user.save().then(null, function() {
        alert("sadness!");
      });
    },
    add_supervisor: function() {
      modal.open('add-supervisor', {user: this.get('model')});
    }
  }
});
