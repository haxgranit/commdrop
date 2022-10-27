import Ember from 'ember';
import speecher from '../utils/speecher';
import utterance from '../utils/utterance';
import i18n from '../utils/i18n';
import coughDropExtras from '../utils/extras';
import modal from '../utils/modal';

export default Ember.Controller.extend({
  title: function() {
    var sentence = this.get('model.sentence') || "something";
    if(this.get('model.show_user') && this.get('model.user')) {
      return (this.get('model.user.name') || this.get('model.user.user_name')) + " said: \"" + sentence + "\"";
    } else {
      return "Someone said: \"" + sentence + "\"";
    }
  }.property('model.sentence', 'model.show_user', 'model.user'),
  check_for_large_image_url: function() {
    var attempt = this.get('attempt') || 1;
    var _this = this;
    if(_this.get('model.permissions.edit') && !_this.get('model.large_image_url') && attempt < 15) {
      Ember.run.later(function() {
        _this.set('attempt', attempt + 1);
        _this.get('model').reload().then(function(u) {
          _this.check_for_large_image_url();
        });
      }, attempt * 500);
    }
  },
  image_url: function() {
    var index = this.get('image_index');
    if(index == undefined) {
      return this.get('model.image_url');
    }

    if(index == -1) {
      return this.get('model.large_image_url');
    } else {
      return this.get('model.button_list')[index].image;
    }
  }.property('model.image_url', 'model.large_image_url', 'image_index'),
  show_share: function() {
    this.check_for_large_image_url();
    this.set('speakable', speecher.ready);
  }.observes('model.sentence'),
  user_showable: function() {
    return this.get('model.show_user') && this.get('model.user.name') && this.get('model.user.user_name');
  }.property('model.show_user', 'model.user.name', 'model.user.user_name'),
  actions: {
    show_attribution: function() {
      this.set('model.show_attribution', true);
    },
    vocalize: function() {
      if(speecher.ready) {
        utterance.speak_text(this.get('model.sentence'));
      }
    },
    change_image: function(direction) {
      var index = this.get('image_index');
      if(index == undefined) {
        var _this = this;
        var image_url = _this.get('model.image_url');
        if(image_url == _this.get('model.large_image_url')) {
          index = -1;
        } else {
          this.get('model.button_list').forEach(function(b, idx) {
            if(b.image == image_url && !index) {
              index = idx;
            }
          });
        }
      }

      if(direction == 'next') {
        index++;
      } else {
        index--;
      }
      if(index == -1 && this.get('model.large_image_url')) {
      } else if(index < 0) {
        index = this.get('model.button_list').length - 1;
      } else if(index >= this.get('model.button_list').length) {
        if(this.get('model.large_image_url')) {
          index = -1;
        } else {
          index = 0;
        }
      }
      this.set('image_index', index);
    },
    copy_event(res) {
      if(res) { modal.success(i18n.t('copied', "Copied to clipboard!")); }
      else { modal.error(i18n.t('copy_failed', "Copy failed unexpectedly")); }
    },
    update_utterance: function() {
      this.set('model.image_url', this.get('image_url'));
      this.get('model').save().then(null, function() {
        modal.error(i18n.t('utterance_update_failed', "Sentence update failed"));
      });
    }
  }
});
