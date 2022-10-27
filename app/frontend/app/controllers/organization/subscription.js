import Ember from 'ember';
import modal from '../../utils/modal';
import i18n from '../../utils/i18n';
import CoughDrop from '../../app';

export default Ember.Controller.extend({
  actions: {
    update_org: function() {
      var org = this.get('model');
      org.save().then(null, function(err) {
        console.log(err);
        modal.error(i18n.t('org_update_failed', 'Organization update failed unexpectedly'));
      });
    }
  }
});
