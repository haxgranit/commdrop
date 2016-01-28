import Ember from 'ember';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({ 
  didInsertElement: function() {
    this.draw();
  },
  draw: function() {
    var stats = this.get('usage_stats');
    var elem = this.get('element').getElementsByClassName('daily_stats')[0];
    
    CoughDrop.Visualizations.wait(function() {
      if(elem && stats && stats.get('days')) {
        var raw_data = [[i18n.t('day', "Day"), i18n.t('total_words', "Total Words"), i18n.t('unique_words', "Unique Words")]];
        for(var day in stats.get('days')) {
          var day_data = stats.get('days')[day];
          raw_data.push([day, day_data.total_words, day_data.unique_words]);
        }
        var data = window.google.visualization.arrayToDataTable(raw_data);

        var options = {
    //          curveType: 'function',
          legend: { position: 'bottom' },
          chartArea: {
            left: 60, top: 20, height: '70%', width: '80%'
          },
          colors: ['#428bca', '#444444' ],
          pointSize: 3
        };
        
        var chart = new window.google.visualization.LineChart(elem);
        window.google.visualization.events.addListener(chart, 'select', function() {
          var selection = chart.getSelection()[0];
          var row = raw_data[selection.row + 1];
          console.log("selected date!");
          console.log(row);
        });
        chart.draw(data, options);
      }
    });
  }.observes('usage_stats.draw_id')
});
