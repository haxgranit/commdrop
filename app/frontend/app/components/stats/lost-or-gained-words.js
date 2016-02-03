import Ember from 'ember';

export default Ember.Component.extend({
  lost_words: function() {
    if(this.get('usage_stats') && this.get('ref_stats') && this.get('this_before_that')) {
      var percents = [];
      var _this = this;
      this.get('usage_stats.words_by_frequency').forEach(function(word) {
        var pre_percent = word.count / _this.get('usage_stats.total_words');
        var found_word = _this.get('ref_stats.words_by_frequency').find(function(w) { return w.text == word.text; });
        var post_percent = found_word ? (found_word.count / _this.get('ref_stats.total_words')) : 0;
        if(post_percent < pre_percent) {
          var res = {
            text: word.text,
            multiplier: Math.round((pre_percent / post_percent) * 10) / 10.0,
            percent: Math.round((pre_percent / post_percent) * 1000) / 10.0,
            pre: Math.round(pre_percent * 1000) / 10.0,
            post: Math.round(post_percent * 1000) / 10.0
          };
          if(post_percent === 0) {
            res.gone = true;
            res.multiplier = pre_percent * 100;
          }
          percents.push(res);
        }
      });
      percents = percents.sort(function(a, b) { return b.multiplier - a.multiplier; });
      percents.some = true;
      return percents.slice(0, 10);
    } 
    return null;
  }.property('usage_stats', 'ref_stats'),
  gained_words: function() {
    if(this.get('usage_stats') && this.get('ref_stats') && !this.get('this_before_that')) {
      var percents = [];
      var _this = this;
      this.get('usage_stats.words_by_frequency').forEach(function(word) {
        var pre_percent = word.count / _this.get('usage_stats.total_words');
        var found_word = _this.get('ref_stats.words_by_frequency').find(function(w) { return w.text == word.text; });
        var post_percent = found_word ? (found_word.count / _this.get('ref_stats.total_words')) : 0;
        if(post_percent > pre_percent) {
          var res = {
            text: word.text,
            multiplier: Math.round((post_percent / pre_percent) * 10) / 10.0,
            percent: Math.round((post_percent / pre_percent) * 1000) / 10.0,
            pre: Math.round(pre_percent * 1000) / 10.0,
            post: Math.round(post_percent * 1000) / 10.0
          };
          if(pre_percent === 0) {
            res['new'] = true;
            res.multiplier = post_percent * 100;
          }
          percents.push(res);
        }
      });
      percents = percents.sort(function(a, b) { return b.percent - a.percent; });
      percents.some = true;
      return percents.slice(0, 10);
    } 
    return null;
  }.property('usage_stats', 'ref_stats'),
  this_before_that: function() {
    if(this.get('usage_stats') && this.get('ref_stats')) {
      return this.get('usage_stats').comes_before(this.get('ref_stats'));
    }
    return false;
  }.property('usage_stats', 'ref_stats'),
  actions: {
    word_cloud: function() {
      this.sendAction('word_cloud');
    }
  }
});
