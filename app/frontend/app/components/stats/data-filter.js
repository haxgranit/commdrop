import Ember from 'ember';
import app_state from '../../utils/app_state';
import i18n from '../../utils/i18n';

export default Ember.Component.extend({
  filter_list: function() {
    var res = [];
    res.push({name: i18n.t('last_2_months', "Last 2 Months"), id: "last_2_months"});
    res.push({name: i18n.t('2_4_months_ago', "2-4 Months Ago"), id: "2_4_months_ago"});
    res.push({name: i18n.t('custom', "Custom Filter"), id: "custom"});
    if(this.get('snapshots')) {
      res.push({name: '----------------', id: '', disabled: true});
      this.get('snapshots').forEach(function(snap) {
        res.push({name: i18n.t('snapshot_dash', "Snapshot - ") + snap.get('name'), id: 'snapshot_' + snap.get('id')});
      });
    }
    return res;
  }.property('snapshots'),
  tall_filter: function() {
    return this.get('usage_stats.custom_filter') || this.get('ref_stats.custom_filter') || this.get('usage_stats.snapshot_id') || this.get('ref_stats.snapshot_id');
  }.property('usage_stats.custom_filter', 'ref_stats.custom_filter', 'usage_stats.snapshot_id', 'ref_stats.snapshot_id'),
  actions: {
    compare_to: function() {
      this.sendAction('compare_to');
    },
    clear_side: function() {
      this.sendAction('clear_side');
    },
    update_filter: function(type) {
      this.sendAction('update_filter', type);
    }
  }
});
