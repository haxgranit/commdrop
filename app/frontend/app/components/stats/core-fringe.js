import Ember from 'ember';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({
  didInsertElement: function() {
    this.draw();
  },
  elem_class: function() {
    if(this.get('side_by_side')) {
      return Ember.String.htmlSafe('col-sm-6');
    } else {
      return Ember.String.htmlSafe('col-sm-4');
    }
  }.property('side_by_side'),
  elem_style: function() {
    if(this.get('right_side')) {
      return Ember.String.htmlSafe('border-left: 1px solid #eee;');
    } else {
      return Ember.String.htmlSafe('');
    }
  }.property('right_side'),
  draw: function() {
    var stats = this.get('usage_stats');
    var elem = this.get('element').getElementsByClassName('core_words')[0];

    CoughDrop.Visualizations.wait('pie-chart', function() {
      if(elem && stats && stats.get('core_words')) {
        var table = [
          ['Type', 'Instances']
        ];
        var parts = stats.get('core_words');
        var slice_idx = 0;
        var slices = {};
        ['core', 'not_core'].forEach(function(key) {
          var str = key;
          if(str == 'not_core') { str = 'fringe'; }
          table.push([str, parts[key] || 0]);
          var color = '#ccc;';
          if(key == 'core') {
            color = '#49c7e8';
          } else if(key == 'not_core') {
            color = '#e5cea2';
          }
          slices[slice_idx] = {color: color};
          slice_idx++;
        });
        var data = window.google.visualization.arrayToDataTable(table);

        var options = {
          slices: slices,
          pieSliceTextStyle: {
            color: '#444'
          }
        };


        var chart = new window.google.visualization.PieChart(elem);

        chart.draw(data, options);
      }
    });
  }.observes('usage_stats.draw_id')
});
