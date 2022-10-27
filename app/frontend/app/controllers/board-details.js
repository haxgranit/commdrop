import Ember from 'ember';
import modal from '../utils/modal';
import BoardHierarchy from '../utils/board_hierarchy';
import i18n from '../utils/i18n';

export default modal.ModalController.extend({
  opening: function() {
    this.set('model', this.get('model.board'));
    var _this = this;
    _this.set('hierarchy', {loading: true});
    BoardHierarchy.load_with_button_set(this.get('model')).then(function(hierarchy) {
      _this.set('hierarchy', hierarchy);
    }, function(err) {
      _this.set('hierarchy', {error: true});
    });
  },
  images_with_license: function() {
    return this.get('model.local_images_with_license');
  }.property('model.buttons', 'model.grid'),
  sounds_with_license: function() {
    return this.get('model.local_sounds_with_license');
  }.property('model.buttons', 'model.grid'),
  language: function() {
    return i18n.readable_language(this.get('model.locale'));
  }.property('model.locale'),
  actions: {
    close: function() {
      modal.close();
    },
    show_licenses: function() {
      this.set('showing_licenses', true);
    },
    boardStats: function() {
      modal.open('board-stats', {board: this.get('model')});
    },
    button_set_words: function() {
      modal.open('button-set', {board: this.get('model'), button_set: this.get('model.button_set')});
    }
  }
});
