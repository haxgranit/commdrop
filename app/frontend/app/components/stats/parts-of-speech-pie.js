import Ember from 'ember';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({ 
  didInsertElement: function() {
    this.draw();
  },
  draw: function() {
    var stats = this.get('usage_stats');
    var elem = this.get('element').getElementsByClassName('parts_of_speech')[0];
    
    CoughDrop.Visualizations.wait(function() {
      if(elem && stats && stats.get('parts_of_speech')) {
        var table = [
          ['Task', 'Instances']
        ];
        var parts = stats.get('parts_of_speech');
        var slice_idx = 0;
        var slices = {};
        var color_check = function(c) { return c.types.indexOf(idx) >= 0; };
        for(var idx in parts) {
          table.push([idx, parts[idx]]);
          var color = CoughDrop.keyed_colors.find(color_check);
          slices[slice_idx] = {color: (color || {border: "#ccc"}).border};
          slice_idx++;
        }
        console.log(slices);
        var data = window.google.visualization.arrayToDataTable(table);

        var options = {
          slices: slices
        };

        var chart = new window.google.visualization.PieChart(elem);

        chart.draw(data, options);
      }
    });
  }.observes('usage_stats.draw_id')
});
