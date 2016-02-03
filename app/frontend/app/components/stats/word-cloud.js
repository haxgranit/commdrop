import Ember from 'ember';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({ 
  didInsertElement: function() {
    this.draw();
  },
  draw: function() {
    var elem = this.get('element').getElementsByClassName('word_cloud')[0];
    if(elem) {
      var list = [];
      var max = 1;
      var _this = this;
      (this.get('stats.words_by_frequency') || []).forEach(function(obj) {
        if(!obj.text.match(/^[\+:]/)) {
          max = Math.max(max, obj.count);
          list.push([obj.text, obj.count]);
        }
      });
      window.WordCloud(elem, {
        list: list,
        gridSize: 16,
        weightFactor: function (size) {
          return ((size / max) * 245 * _this.get('zoom')) + 5;
        }
      });
    }
  }.observes('stats', 'zoom', 'word_cloud_id')
});
