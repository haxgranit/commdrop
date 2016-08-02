import Ember from 'ember';
import modal from '../utils/modal';
import CoughDrop from '../app';

export default modal.ModalController.extend({
  opening: function() {
    var integration = CoughDrop.store.createRecord('integration', {
      custom_integration: true,
      user_id: this.get('model.user.id')
    });
    this.set('status', null);
    this.set('integration', integration);
  },
  actions: {
    save: function() {
      var _this = this;
      _this.set('status', {saving: true});
      var integration = this.get('integration');
      var hooks = [];
      integration.save().then(function(res) {
        modal.close({created: true});
        modal.open('integration-details', {integration: integration});
      }, function(err) {
        _this.set('status', {error: true});
      });
    }
  }
});
