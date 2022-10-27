import Component from '@ember/component';
import { htmlSafe } from '@ember/string';

export default Component.extend({
  elem_class: computed(function() {
    if(this.get('side_by_side')) {
      return htmlSafe('col-sm-6');
    } else {
      return htmlSafe('col-sm-4');
    }
  }).property('side_by_side'),
  elem_style: computed(function() {
    if(this.get('right_side')) {
      return htmlSafe('border-left: 1px solid #eee;');
    } else {
      return htmlSafe('');
    }
  }).property('right_side'),
  core_words: computed(function() {
    var res = [];
    var words = this.get('core.for_user') || [];
    var available = {};
    (this.get('core.reachable_for_user') || []).forEach(function(word) {
      available[word] = true;
    });
    var weighted = this.get('usage_stats.weighted_words') || [];
    words.forEach(function(word) {
      var weight = 'weighted_word weight_0';
      if(available[word]) {
        var found = weighted.find(function(w) { return w.text.toLowerCase() == word.toLowerCase(); });
        weight = found ? found.weight_class : 'weighted_word weight_1';
      }
      res.push({
        text: word,
        weight_class: weight
      });
    });
    return res;
  }).property('core', 'usage_stats', 'usage_stats.weighted_words', 'usage_stats.draw_id'),
  actions: {
    word_cloud: function() {
      this.sendAction('word_cloud');
    },
    word_data: function(word) {
      this.sendAction('word_data', word);
    },
    modify_core: function() {
      this.sendAction('modify_core');
    }
  }
});
//   {{#each core_words as |word|}}
//     <span class={{word.weight_class}}>{{word.text}}</span>
//   {{/each}}
