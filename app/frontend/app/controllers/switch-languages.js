import Ember from 'ember';
import modal from '../utils/modal';
import app_state from '../utils/app_state';
import stashes from '../utils/_stashes';
import {set as emberSet, get as emberGet} from '@ember/object';
import i18n from '../utils/i18n';

export default modal.ModalController.extend({
  opening: function() {
    var labels = app_state.get('label_locale') || this.get('model.board.translations.current_label') || this.get('model.board.locale') || 'en';
    var vocalizations = app_state.get('vocalization_locale') || this.get('model.board.translations.current_vocalization') || this.get('model.board.locale') || 'en';
    this.set('label_locale', labels);
    this.set('vocalization_locale', vocalizations);
    if(labels == vocalizations) { this.set('same_locale', true); }
  },
  update_matching_other: function(stuff, change) {
    if(change == 'vocalization_locale' && this.get('same_locale')) {
      this.set('label_locale', this.get('vocalization_locale'));
    }
    var _this = this;
    this.get('locales').forEach(function(l) {
      if(emberGet(l, 'id') == _this.get('vocalization_locale')) {
        emberSet(l, 'vocalization_locale', true);
      } else if(emberGet(l, 'vocalization_locale')) {
        emberSet(l, 'vocalization_locale', false);
      }
      if(emberGet(l, 'id') == _this.get('label_locale')) {
        emberSet(l, 'label_locale', true);
      } else if(emberGet(l, 'label_locale')) {
        emberSet(l, 'label_locale', false);
      }
    });
  }.observes('label_locale', 'vocalization_locale', 'locales'),
  two_languages: function() {
    return this.get('locales.length') == 2;
  }.property('locales'),
  locales: function() {
    var root_locales = {};
    var locales = this.get('model.board.locales') || [];
    var list = i18n.get('locales');
    var res = [];
    locales.forEach(function(l) {
      var root = l.split(/-|_/)[0];
      root_locales[root] = (root_locales[root] || 0) + 1;
    })
    for(var key in list) {
      if(locales.indexOf(key) != -1) {
        var root = key.split(/-|_/)[0];
        var name = list[key];
        // If there aren't multiple locales with the same
        // language, just use the language and the descriptor
        if(!root_locales[root] || root_locales[root] == 1 && list[root]) {
          name = list[root];
        }
        res.push({name: name, id: key});
      }
    }
    return res;
  }.property('model.board', 'model.board.locales'),
  actions: {
    set_locale: function(type, val) {
      this.set(type + '_locale', val);
    },
    set_languages: function() {
      app_state.set('label_locale', this.get('label_locale'));
      stashes.persist('label_locale', this.get('label_locale'));
      app_state.set('vocalization_locale', this.get('vocalization_locale'));
      stashes.persist('vocalization_locale', this.get('vocalization_locale'));
      modal.close({switched: true});
    },
    clear_languages: function() {
      app_state.set('label_locale', null);
      stashes.persist('label_locale', null);
      app_state.set('vocalization_locale', null);
      stashes.persist('vocalization_locale', null);
      modal.close({switched: true});
    }
  }
});
