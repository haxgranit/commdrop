import modal from '../utils/modal';
import i18n from '../utils/i18n';
import persistence from '../utils/persistence';
import { observer } from '@ember/object';

export default modal.ModalController.extend({
  opening: function() {
    var _this = this;
    _this.set('state', null);
    var found = false;
    var words = this.get('model.user.core_lists.for_user') || [];
    var words_json = JSON.stringify(words);
    (this.get('model.user.core_lists.defaults') || []).forEach(function(list) {
      if(JSON.stringify(list.words) == words_json) {
        found = true;
        _this.set('core_list', list.id);
      }
    });
    if(!found && words.length > 0) {
      _this.set('core_list', 'custom');
      _this.set('words', words);
    }
  },
  default_core_list: function() {
    return this.get('core_list') && this.get('core_list') != 'new' && this.get('core_list') != 'custom';
  }.property('core_list'),
  update_on_change: observer('core_list', function() {
    if(this.get('core_list') == 'custom') {
      this.set('words', []);
      this.set('editing', true);
    } else if(this.get('core_list')) {
      this.set('editing', false);
      var _this = this;
      (this.get('model.user.core_lists.defaults') || []).forEach(function(list) {
        if(list.id == _this.get('core_list')) {
          _this.set('words', list.words);
        }
      });
    }
  }),
  word_lines: function() {
    return (this.get('words') || []).join('\n');
  }.property('words'),
  parsed_words: function() {
    var words = (this.get('word_lines') || "").split(/[\n,]/).filter(function(w) { return w && w.length > 0; });
    return words;
  }.property('word_lines'),
  core_lists: function() {
    var res = [];
    res.push({name: i18n.t('chose_list', "[Choose List]"), id: ''});
    (this.get('model.user.core_lists.defaults') || []).forEach(function(list) {
      res.push({name: list.name, id: list.id});
    });
    res.push({name: i18n.t('customized_list', "Customized List"), id: 'custom'});
    return res;
  }.property('model.user.core_lists.defaults'),
  save_disabled: function() {
    return !!(this.get('state.saving') || (this.get('words') || []).length === 0);
  }.property('state.saving', 'words'),
  actions: {
    modify_list: function() {
      var words = this.get('words');
      this.set('core_list', 'custom');
      this.set('words', words);
    },
    save: function() {
      var words = this.get('parsed_words');
      if(words.length === 0) { return; }
      var data = {
        '_method': 'PUT',
        id: this.get('core_list'),
        words: words
      };
      var _this = this;
      _this.set('state', {saving: true});
      persistence.ajax('/api/v1/users/' + _this.get('model.user.id') + '/core_list', {
        type: 'POST',
        data: data
      }).then(function(res) {
        _this.set('state', null);
        modal.close('modify-core-words');
      }, function(err) {
        _this.set('state', {error: true});
      });
    }
  }
});
