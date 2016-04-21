import modal from '../utils/modal';
import persistence from '../utils/persistence';
import i18n from '../utils/i18n';
import CoughDrop from '../app';

export default modal.ModalController.extend({
  opening: function() {
    this.set('loading', false);
    this.set('error', false);
  },
  actions: {
    confirm: function() {
      var _this = this;
      _this.set('loading', true);
      persistence.ajax('/api/v1/utterances/' + this.get('model.utterance.id') + '/share', {
        type: 'POST',
        data: {
          supervisor_id: this.get('model.user.id')
        }
      }).then(function(data) {
        _this.set('loading', false);
        modal.close('confirm-notify-user');
        modal.success(i18n.t('user_notified', "Message sent!"));
      }, function(err) {
        _this.set('loading', false);
        _this.set('error', true);
      });
    }
  }
});
