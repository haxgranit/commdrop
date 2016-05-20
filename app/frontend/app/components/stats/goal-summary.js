import Ember from 'ember';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({
  didInsertElement: function() {
    this.draw();
  },
  draw: function() {
    var goal = this.get('goal');
    var elem = this.get('element').getElementsByClassName('stats')[0];

    CoughDrop.Visualizations.wait('goal-summary', function() {
      if(elem && goal && goal.get('time_units')) {
        var raw_data = [[goal.get('unit_description'), i18n.t('positive_measurements', "Positive Measurements"), i18n.t('negative_measurements', "Negative Measurements")]];
        var max_score = 0;
        var min_score = 0;
        goal.get('time_units').forEach(function(unit) {
          var unit_data = goal.get('time_unit_measurements')[unit.key] || {positives: 0, negatives: 0};
          raw_data.push([unit.label, unit_data.positives, 0 - unit_data.negatives]);
          max_score = Math.max(max_score, unit_data.positives || 0);
          min_score = Math.max(min_score, (0 - unit_data.negatives) || 0);
        });
        var data = window.google.visualization.arrayToDataTable(raw_data);

        var options = {
          curveType: 'function',
          legend: { position: 'bottom' },
          chartArea: {
            left: 60, top: 20, height: '70%', width: '80%'
          },
          vAxis: {
            baseline: 0,
            viewWindow: {
              min: min_score,
              max: max_score
            }
          },
          colors: ['#008800', '#880000' ],
          pointSize: 3
        };

        var chart = new window.google.visualization.LineChart(elem);
        window.google.visualization.events.addListener(chart, 'select', function() {
          var selection = chart.getSelection()[0];
          var row = raw_data[selection.row + 1];
          console.log("selected date!");
        });
        chart.draw(data, options);
      }
    });
  }.observes('goal.draw_id')
});
