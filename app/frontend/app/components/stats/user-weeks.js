import Ember from 'ember';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({
  didInsertElement: function() {
    this.draw();
  },
  draw: function() {
    var $elem = Ember.$(this.get('element'));
    $elem.find(".week").tooltip({container: 'body'});
  },
  communicators_with_stats: function() {
    var res = this.get('users') || [];
    if(this.get('weeks')) {
      var user_weeks = this.get('weeks');

      var max_count = 1;
      for(var user_id in user_weeks) {
        for(var week_stamp in user_weeks[user_id]) {
          max_count = Math.max(max_count, user_weeks[user_id][week_stamp].count);
        }
      }

      var populated_stamps = this.get('populated_stamps');

      res.forEach(function(user) {
        var weeks = user_weeks[user.id];
        user.week_stats = [];
        populated_stamps.forEach(function(stamp) {
          console.log(weeks && weeks[stamp]);
          var count = (weeks && weeks[stamp] && weeks[stamp].count) || 0;
          var goals = (weeks && weeks[stamp] && weeks[stamp].goals) || 0;
          var level = Math.round(count / max_count * 10);
          var str = i18n.t('n_sessions', "session", {count: count});
          if(goals > 0) {
            str = str + i18n.t('comma', ", ");
            str = str + i18n.t('n_goals', "goal event", {count: goals});
          }
          user.week_stats.push({
            count: count,
            tooltip: str,
            goals: goals,
            class: 'week level_' + level
          });
        });
      });
    }
    var _this = this;
    Ember.run.later(function() {
      _this.draw();
    });
    return res;
  }.property('users', 'weeks', 'populated_stamps'),
  labeled_weeks: function() {
    return this.get('populated_stamps').map(function(s) { return window.moment(s * 1000).format('MMM DD, \'YY'); });
  }.property('populated_stamps'),
  populated_stamps: function() {
    if(this.get('weeks')) {
      var weeks = this.get('weeks');
      var max_count = 0;
      var all_stamps = [];
      for(var user_id in weeks) {
        for(var week_stamp in weeks[user_id]) {
          max_count = Math.max(max_count, weeks[user_id][week_stamp]);
          if(all_stamps.indexOf(week_stamp) == -1) {
            all_stamps.push(week_stamp);
          }
        }
      }
      all_stamps = all_stamps.sort();
      var populated_stamps = [];
      var three_weeks_ago = window.moment().add(-3, 'week').unix();
      if(all_stamps.length === 0 || all_stamps[0] > three_weeks_ago) {
        all_stamps.unshift(three_weeks_ago);
      }
      var ref_stamp = all_stamps[0];
      var now = (new Date()).getTime() / 1000;
      while(ref_stamp < now) {
        if(all_stamps.length > 0) {
          ref_stamp = all_stamps.shift();
        }
        populated_stamps.push(ref_stamp);

        var m = null;
        while(m == null || (ref_stamp < now && ref_stamp < all_stamps[0])) {
          if(m) {
            populated_stamps.push(ref_stamp);
          }
          var m = window.moment(ref_stamp * 1000);
          m.add(1, 'week');
          ref_stamp = m.unix() + 1;
        }
      }
      populated_stamps = populated_stamps.slice(-10);
      console.log(populated_stamps.map(function(s) { return new Date(s * 1000); }));
      return populated_stamps;
    }
    return [];
  }.property('weeks')
});

