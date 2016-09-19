import Ember from 'ember';
import modal from '../utils/modal';
import editManager from '../utils/edit_manager';
import app_state from '../utils/app_state';
import BoardHierarchy from '../utils/board_hierarchy';
import i18n from '../utils/i18n';

export default modal.ModalController.extend({
  opening: function() {
    var _this = this;
    _this.set('loading', true);
    _this.set('error', null);
    var board = _this.get('model.board');
    if(this.get('model.action') == 'keep_links') {
      _this.start_copying();
    } else {
      BoardHierarchy.load_with_button_set(board).then(function(hierarchy) {
        _this.set('loading', false);
        if(hierarchy && hierarchy.get('root')) {
          _this.set('hierarchy', hierarchy);
        } else {
          _this.start_copying();
        }
      }, function(err) {
        _this.set('loading', false);
        _this.set('error', err);
      });
    }
  },
  start_copying: function() {
    var board_ids_to_include = null;
    if(this.get('hierarchy')) {
      board_ids_to_include = this.get('hierarchy').selected_board_ids();
      this.set('hierarchy', null);
    }
    this.get('model.board').set('downstream_board_ids_to_copy', board_ids_to_include);
    var _this = this;
    editManager.copy_board(_this.get('model.board'), _this.get('model.action'), _this.get('model.user')).then(function(board) {
      var next = Ember.RSVP.resolve();
      if(_this.get('model.shares') && _this.get('model.shares').length > 0) {
        var promises = [];
        _this.get('model.shares').forEach(function(share) {
          next = next.then(function() {
            var user_name = share.user_name;
            var sharing_key = "add_deep-" + user_name;
            board.set('sharing_key', sharing_key);
            return board.save();
          });
        });
        next = next.then(null, function() {
          return Ember.RSVP.reject(i18n.t('sharing_failed', "Sharing with one or more users failed"));
        });
      }

      next.then(function() {
        if(modal.is_open('copying-board')) {
          app_state.jump_to_board({
            id: board.get('id'),
            key: board.get('key')
          });
          modal.close({copied: true, id: board.get('id'), key: board.get('key')});
        } else {
          modal.notice(i18n.t('copy_created', "Copy created! You can find the new board in your profile."));
        }
      }, function(err) {
        if(modal.is_open('copying-board')) {
          _this.set('error', err);
        } else {
          modal.error(err);
        }
      });
    }, function(err) {
      if(modal.is_open('copying-board')) {
        _this.set('error', err);
      } else {
        modal.error(err);
      }
    });
  },
  actions: {
    confirm_hierarchy: function() {
      this.start_copying();
    },
    start_copying: function() {
      this.start_copying();
    }
  }
});
