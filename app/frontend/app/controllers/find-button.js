import Ember from 'ember';
import modal from '../utils/modal';
import persistence from '../utils/persistence';
import i18n from '../utils/i18n';
import app_state from '../utils/app_state';
import editManager from '../utils/edit_manager';


export default modal.ModalController.extend({
  opening: function() {
    this.set('searchString', '');
    Ember.run.later(function() {
      Ember.$("#button_search_string").focus();
    }, 100);
  },
  search: function() {
    this.set('results', null);
    var board = modal.settings_for['find-button'].board;
    if(this.get('searchString')) {
      var _this = this;
      _this.set('loading', true);
      _this.set('error', null);
      // TODO: only show other boards if in speak mode!
      var include_other_boards = this.get('model.include_other_boards');
      if(board.get('button_set')) {
        var user = app_state.get('currentUser');
        var include_home = app_state.get('speak_mode');
        board.get('button_set').find_buttons(this.get('searchString'), user, include_home).then(function(results) {
          if(persistence.get('online')) {
            _this.set('results', results);
            _this.set('loading', false);
          } else {
            var new_results = [];
            var promises = [];
            results.forEach(function(b) {
              if(b.image && b.image.match(/^data/)) {
                new_results.push(b);
              } else {
                promises.push(persistence.find_url(b.image, 'image').then(function(data_uri) {
                  b.image = data_uri;
                  new_results.push(b);
                }));
              }
            });
            Ember.RSVP.all_wait(promises).then(null, function() { return Ember.RSVP.resolve(); }).then(function() {
              _this.set('results', new_results);
              _this.set('loading', false);
            });
          }
          _this.set('results', results);
          _this.set('loading', false);
        }, function(err) {
          _this.set('loading', false);
          _this.set('error', err.error);
        });
      } else {
        _this.set('loading', false);
        _this.set('error', i18n.t('button_set_not_found', "Button set not downloaded, please syncing or going online and reopening this board"));
      }      
    }
  }.observes('searchString'),
  actions: {
    pick_result: function(result) {
      if(result.board_id == editManager.controller.get('model.id')) {
        var $button = Ember.$(".button[data-id='" + result.id + "']");
        var _this = this;
        modal.highlight($button).then(function() {
          var button = editManager.find_button(result.id);
          var board = editManager.controller.get('model');
          app_state.controller.activateButton(button, {image: button.get('image'), sound: button.get('sound'), board: board});
        }, function() { });
      } else {
        var buttons = result.pre_buttons || [];
        if(result.pre_action == 'home') {
          buttons.unshift('home');
        }
        buttons.push(result);
        app_state.controller.set('button_highlights', buttons);
        app_state.controller.send('highlight_button');
      }
    }
  }
});