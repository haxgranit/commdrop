import modal from '../utils/modal';
import persistence from '../utils/persistence';
import stashes from '../utils/_stashes';

export default modal.ModalController.extend({
  text_note: function() {
    return this.get('note_type') == 'text';
  }.property('note_type'),
  video_note: function() {
    return this.get('note_type') == 'video';
  }.property('note_type'),
  opening: function() {
    var type = this.get('model.type');
    this.set('model', this.get('model.user'));
    if(this.get('note_type') === undefined) { this.set('note_type', 'text'); }
    if(this.get('notify') === undefined) { this.set('notify', true); }
  },
  video_allowed: function() {
    // must have an active paid subscription to access video logs on your account
    return this.get('model.full_premium');
  }.property('model', 'note_type', 'model.full_premium'),
  no_video_ready: function() {
    return !this.get('video_id');
  }.property('video_id'),
  text_class: function() {
    var res = "btn ";
    if(this.get('text_note')) {
      res = res + "btn-primary";
    } else {
      res = res + "btn-default";
    }
    return res;
  }.property('text_note'),
  video_class: function() {
    var res = "btn ";
    if(this.get('text_note')) {
      res = res + "btn-default";
    } else {
      res = res + "btn-primary";
    }
    return res;
  }.property('text_note'),
  actions: {
    set_type: function(type) {
      this.set('note_type', type);
    },
    video_ready: function(id) {
      this.set('video_id', id);
    },
    video_not_ready: function() {
      this.set('video_id', false);
    },
    saveNote: function(type) {
      if(type == 'video' && !this.get('video_id')) { return; }
      var note = {
        text: this.get('note')
      };
      if(persistence.get('online')) {
        var log = this.store.createRecord('log', {
          user_id: this.get('model.id'),
          note: note,
          timestamp: Date.now() / 1000,
          notify: this.get('notify')
        });
        if(type == 'video') {
          log.set('video_id', this.get('video_id'));
        }
        var _this = this;
        log.save().then(function() {
          modal.close(true);
        }, function() { });
      } else {
        stashes.log_event({
          note: note,
          notify: this.get('notify')
        }, this.get('model.id'));
      }
    }
  }
});
