import Ember from 'ember';
import i18n from '../../utils/i18n';
import Utils from '../../utils/misc';
import persistence from '../../utils/persistence';
import modal from '../../utils/modal';

export default Ember.Controller.extend({
  refresh_stats: function() {
    var _this = this;
    _this.set('weekly_stats', null);
    _this.set('user_counts', null);
    _this.set('user_weeks', null);
    persistence.ajax('/api/v1/units/' + this.get('model.id') + '/stats', {type: 'GET'}).then(function(stats) {
      _this.set('weekly_stats', stats.weeks);
      _this.set('user_counts', stats.user_counts);
      stats.user_weeks.populated = true;
      _this.set('user_weeks', stats.user_weeks);
    }, function() {
      _this.set('weekly_stats', {error: true});
    });
  },
  refresh_logs: function() {
    var _this = this;
    this.set('logs', {loading: true});
    persistence.ajax('/api/v1/units/' + this.get('model.id') + '/logs', {type: 'GET'}).then(function(data) {
      _this.set('logs.loading', null);
      _this.set('logs.data', data.log);
    }, function() {
      _this.set('logs.loading', null);
      _this.set('logs.data', null);
    });
  },
  first_log: function() {
    return (this.get('logs.data') || [])[0];
  }.property('logs.data'),
  load_users: function() {
  },
});
