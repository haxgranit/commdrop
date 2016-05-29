import Ember from 'ember';
import DS from 'ember-data';
import CoughDrop from '../app';
import i18n from '../utils/i18n';
import Utils from '../utils/misc';

CoughDrop.Goal = DS.Model.extend({
  user_id: DS.attr('string'),
  video_id: DS.attr('string'),
  has_video: DS.attr('boolean'),
  primary: DS.attr('boolean'),
  active: DS.attr('boolean'),
  template: DS.attr('boolean'),
  template_header: DS.attr('boolean'),
  summary: DS.attr('string'),
  description: DS.attr('string'),
  permissions: DS.attr('raw'),
  video: DS.attr('raw'),
  user: DS.attr('raw'),
  author: DS.attr('raw'),
  comments: DS.attr('raw'),
  started: DS.attr('date'),
  ended: DS.attr('date'),
  stats: DS.attr('raw'),
  best_time_level: function() {
    var stats = this.get('stats') || {};
    if(stats && stats.monthly && stats.monthly.totals && stats.monthly.totals.sessions > 0) {
      var levels = {};
      var suggested_level = null;
      ['daily', 'weekly', 'monthly'].forEach(function(level) {
        levels[level] = [];
        var hash = stats[level] || {};
        for(var idx in hash) {
          if(idx != 'totals') {
            levels[level].push(idx);
          }
        }
        var last_value = levels[level].sort().reverse()[0];
        // if there's no data, just do daily or something
        // preference for the lowest level
        if(level == 'daily') {
          // if nothing's happened in the last 2 weeks, don't use daily
          // if weekly has the same sessions as daily, use daily
          var two_weeks_ago = window.moment().add(-2, 'weeks').toISOString().substring(0, 10);
          if(last_value > two_weeks_ago) {
            if(stats.weekly && stats.weekly.totals && stats.daily && stats.daily.totals && stats.weekly.totals.sessions == stats.daily.totals.sessions) {
              suggested_level = 'daily';
            }
          }
        } else if(level == 'weekly') {
          // if nothing's happened in the last 12 weeks, don't use weekly
          // if monthly has the same sessions as weekly, use weekly unless already using daily
          var twelve_weeks_ago = window.moment().add(-12, 'weeks').format('GGGG-WW');
          if(last_value > twelve_weeks_ago) {
            if(stats.monthly && stats.monthly.totals && stats.weekly && stats.weekly.totals && stats.monthly.totals.sessions == stats.weekly.totals.sessions) {
              suggested_level = suggested_level || 'weekly';
            }
          }
        } else if(level == 'monthly') {
          suggested_level = suggested_level || 'monthly';
          // otherwise use monthly
        }

      });
      return suggested_level;
    } else {
      return 'none';
    }
  }.property('stats'),
  time_units: function() {
    var level = this.get('best_time_level');
    var stats = this.get('stats');
    var units = [];
    if(level == 'daily') {
      var days = [];
      var day = window.moment();
      for(var idx = 0; idx < 14; idx++) {
        var key = day.toISOString().substring(0, 10);
        days.push({
          key: key,
          label: day.toISOString().substring(0, 10),
          sessions: ((stats.daily[key] || {}).sessions || 0),
          max_statuses: Utils.max_appearance((stats.daily[key] || {}).statuses || [])
        });
        day = day.add(-1, 'days');
      }
      units = days;
    } else if(level == 'weekly') {
      var weeks = [];
      var week = window.moment();
      for(var idx = 0; idx < 12; idx++) {
        var key = week.clone().weekday(1).format('GGGG-WW');
        weeks.push({
          key: key,
          label: week.clone().weekday(0).toISOString().substring(0, 10),
          sessions: ((stats.weekly[key] || {}).sessions || 0),
          max_statuses: Utils.max_appearance((stats.weekly[key] || {}).statuses || [])
        });
        week = week.add(-1, 'weeks');
      }
      units = weeks;
    } else if(level == 'monthly') {
      var months = [];
      var month_keys = [];
      var monthly = this.get('stats').monthly || {};
      for(var idx in monthly) {
        if(idx != 'totals') {
          month_keys.push(idx);
        }
      }
      var last_month = month_keys.sort().reverse()[0];
      var first_month = month_keys.sort()[0];
      var date = window.moment(last_month, 'YYYY-MM');
      for(var idx = 0; idx < 36; idx++) {
        var key = date.format('YYYY-MM');
        months.push({
          key: key,
          label: date.toISOString().substring(0, 10),
          sessions: ((stats.monthly[key] || {}).sessions || 0),
          max_statuses: Utils.max_appearance((stats.monthly[key] || {}).statuses || [])
        });
        date = date.add(-1, 'month');
      }
      units = months;
    }
    var reversed_units = [];
    var found_session = false;
    units.reverse().forEach(function(unit, idx) {
      if(found_session || unit.sessions > 0 || idx > (units.length - 5)) {
        found_session = true;
        reversed_units.push(unit);
      }
    });
    var max = Math.max.apply(null, units.mapProperty('max_statuses'));
    reversed_units.max = max;
    return reversed_units;
  }.property('stats', 'best_time_level'),
  unit_description: function() {
    var level = this.get('best_time_level');
    if(level == 'daily') {
      return i18n.t('day', "Day");
    } else if(level == 'weekly') {
      return i18n.t('week', "Week");
    } else if(level == 'monthly') {
      return i18n.t('month', "Month");
    } else {
      return i18n.t('no_unit', "No Data");
    }
  }.property('stats', 'best_time_level'),
  time_unit_measurements: function() {
    return this.get('stats')[this.get('best_time_level')] || {};
  }.property('stats', 'best_time_level'),
  time_unit_status_rows: function() {
    if(this.get('best_time_level') == 'none') { return []; }
    var units = this.get('time_units');
    var rows = [{
      status_class: 'face', tooltip: i18n.t('we_did_awesome', "We did awesome! (4)"), time_blocks: []
    }, {
      status_class: 'face happy', tooltip: i18n.t('we_did_good', "We did good! (3)"), time_blocks: []
    }, {
      status_class: 'face neutral', tooltip: i18n.t('we_barely_did_id', "We barely did it (2)"), time_blocks: []
    }, {
      status_class: 'face sad', tooltip: i18n.t('we_didnt_do_it', "We didn't do it (1)"), time_blocks: []
    }];
    for(var idx = 0; idx < 14 && idx < units.length; idx++) {
      var unit = units[idx];
      var unit_stats = (this.get('stats')[this.get('best_time_level')] || {})[unit.key] || {};
      var statuses = unit_stats.statuses || [];
      var score = statuses.filter(function(s) { return s == 4; }).length;
      var level = Math.ceil(score / units.max * 10);
      rows[0].time_blocks.push({
        score: score,
        tooltip: score ? (i18n.t('status_sessions', 'status', {count: score}) + ', ' + unit.label) : "",
        style_class: 'time_block level_' + level
      });
      score = statuses.filter(function(s) { return s == 3; }).length;
      level = Math.ceil(score / units.max * 10);
      rows[1].time_blocks.push({
        score: score,
        tooltip: score ? (i18n.t('status_sessions', 'status', {count: score}) + ', ' + unit.label) : "",
        style_class: 'time_block level_' + level
      });
      score = statuses.filter(function(s) { return s == 2; }).length;
      level = Math.ceil(score / units.max * 10);
      rows[2].time_blocks.push({
        score: score,
        tooltip: score ? (i18n.t('status_sessions', 'status', {count: score}) + ', ' + unit.label) : "",
        style_class: 'time_block level_' + level
      });
      score = statuses.filter(function(s) { return s == 1; }).length;
      level = Math.ceil(score / units.max * 10);
      rows[3].time_blocks.push({
        score: score,
        tooltip: score ? (i18n.t('status_sessions', 'status', {count: score}) + ', ' + unit.label) : "",
        style_class: 'time_block level_' + level
      });
    }
    return rows;
  }.property('stats', 'best_time_level')
});

export default CoughDrop.Goal;
