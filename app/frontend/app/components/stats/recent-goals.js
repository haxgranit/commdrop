import Ember from 'ember';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({
  didInsertElement: function() {
    this.draw();
  },
  draw: function() {
    var total = this.get('total');
    var tracked = this.get('tracked');
    var untracked = this.get('untracked');
    var elem = this.get('element').getElementsByClassName('recent_goals')[0];

    CoughDrop.Visualizations.wait('pie-chart', function() {
      if(elem && total) {
        var table = [
          ['Type', 'Total']
        ];
        var no_goal = total - untracked;
        table.push([i18n.t('goal_tracked', "Tracked Goal"), tracked]);
        table.push([i18n.t('untracked_goal', "Untracked Goal"), untracked - tracked]);
        table.push([i18n.t('no_goal', "No Goal Set"), total - untracked]);
        var data = window.google.visualization.arrayToDataTable(table);

        var options = {
          title: i18n.t('user_sessions', "User With Goals Defined"),
          legend: {
            position: 'top',
            maxLines: 2
          },
          slices: {
            0: {color: "#458c5e"},
            1: {color: "#F1B366"},
            2: {color: "#888888"}
          }
        };

        var chart = new window.google.visualization.PieChart(elem);
        chart.draw(data, options);
      }
    });
  }.observes('total', 'recent')
});

