import Ember from 'ember';
import modal from '../utils/modal';
import CoughDrop from '../app';
import app_state from '../utils/app_state';
import i18n from '../utils/i18n';
import editManager from '../utils/edit_manager';

export default modal.ModalController.extend({
  opening: function() {
    this.set('goal', this.store.createRecord('goal'));
    this.set('error', false);
    this.set('saving', false);
  },
  pending_save: function() {
    return !!this.get('video_pending');
  }.property('video_pending'),
  actions: {
    save_goal: function() {
      var _this = this;
      var goal = this.get('goal');
      goal.set('user_id', this.get('model.user.id'));
      goal.set('active', true);
      // TODO: something about attaching the video
      _this.set('saving', true);
      _this.set('error', false);
      goal.save().then(function() {
        _this.set('saving', false);
        modal.close(true);
      }, function() {
        _this.set('saving', false);
        _this.set('error', true);
      });
    },
    video_ready: function(id) {
      this.set('video_pending', false);
      if(this.get('goal')) {
        this.set('goal.video_id', id);
      }
    },
    video_not_ready: function() {
      this.set('video_pending', false);
      if(this.get('goal')) {
        this.set('goal.video_id', null);
      }
    },
    video_pending: function() {
      this.set('video_pending', true);
      if(this.get('goal')) {
        this.set('goal.video_id', null);
      }
    }
  }
});
