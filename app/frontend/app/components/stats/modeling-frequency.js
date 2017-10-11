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
      return Ember.String.htmlSafe('col-sm-8');
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
    var trends = this.get('trends');
    var elem = this.get('element').getElementsByClassName('modeling_frequency')[0];

    CoughDrop.Visualizations.wait('word-graph', function() {
      if(elem && trends && trends.weeks) {
        var weeks = [];
        for(var idx in trends.weeks) {
          trends.weeks[idx].weekyear = idx;
          var wy = idx.toString();
          trends.weeks[idx].date = moment(wy.substring(0, 4) + "-W" + wy.substring(4, 6) + "-0");
          weeks.push(trends.weeks[idx]);
        }
        weeks = weeks.sort(function(a, b) { return a.weekyear - b.weekyear; });

        var raw_data = [[i18n.t('week of', "Week Of"), i18n.t('percent_modeled', "Percent Modeled")]];
        var max_val = 10;
        weeks.forEach(function(week) {
          var row = [week.date.format('YYYY-MM-DD'), (week.modeled_percent || 0) * 100];
          raw_data.push(row);
          max_val = Math.max(max_val, (week.modeled_percent || 0) * 100);
        });

        var data = window.google.visualization.arrayToDataTable(raw_data);

        var options = {
    //          curveType: 'function',
          legend: { position: 'bottom' },
          chartArea: {
            left: 60, top: 20, height: '70%', width: '80%'
          },
          vAxis: {
            baseline: 0,
            viewWindow: {
              min: 0,
              max: max_val
            }
          },
          colors: ['#f2b367', '#428bca', '#444444'],
          pointSize: 6
        };

        var chart = new window.google.visualization.AreaChart(elem);
        window.google.visualization.events.addListener(chart, 'select', function() {
          var selection = chart.getSelection()[0];
          var row = raw_data[selection.row + 1];
          console.log("selected date!");
        });
        chart.draw(data, options);
      }
    });
  }.observes('usage_stats.draw_id', 'ref_stats.draw_id'),
  actions: {
    set_modeling: function(modeling) {
      this.set('usage_stats.modeling', !!modeling);
      if(this.get('ref_stats')) {
        this.set('ref_stats.modeling', !!modeling);
      }
    }
  }
});
