import Ember from 'ember';
import modal from '../utils/modal';
import persistence from '../utils/persistence';
import i18n from '../utils/i18n';
import progress_tracker from '../utils/progress_tracker';

export default modal.ModalController.extend({
  pdf_download: function() {
    return this.get('model.type') == 'pdf';
  }.property('model.type'),
  obf_download: function() {
    return this.get('model.type') == 'obf';
  }.property('model.type'),
  opening: function() {
    this.set('progress', null);
    this.set('track_id', null);
    if(persistence.get('online')) {
      this.send('startDownload');
    }
  },
  actions: {
    startDownload: function(decision) {
      if(decision || (!this.get('model.has_links') && this.get('download_type'))) {
        var type = this.get('model.type');
        if(decision == 'all' && type == 'obf') { type = 'obz'; }
        var url = '/api/v1/boards/' + this.get('model.id') + '/download?type=' + type + '&include=' + decision;
        if(!this.get('include_header') && !this.get('download_type')) {
          url = url + "&headerless=1";
        }
        if(!this.get('text_below') && !this.get('download_type')) {
          url = url + "&text_on_top=1";
        }
        var download = persistence.ajax(url, {type: 'POST'});
        var _this = this;
        this.set('progress', {
          status: 'pending'
        });
        download.then(function(data) {
          var track_id = progress_tracker.track(data.progress, function(progress) {
            _this.set('progress', progress);
          });
          _this.set('track_id', track_id);
        }, function() {
          _this.set('progress', {
            status: 'errored',
            result: i18n.t("Download failed unexpectedly", 'board_download_failed')
          });
        });
      }
    },
    close: function() {
      progress_tracker.untrack(this.get('track_id'));
      modal.close();
    }
  },
  pending: function() {
    return this.get('progress.status') == 'pending';
  }.property('progress.status'),
  started: function() {
    return this.get('progress.status') == 'started';
  }.property('progress.status'),
  finished: function() {
    return this.get('progress.status') == 'finished';
  }.property('progress.status'),
  errored: function() {
    return this.get('progress.status') == 'errored';
  }.property('progress.status'),
  status_message: function() {
    return progress_tracker.status_text(this.get('progress.status'), this.get('porgress.sub_status'));
  }.property('progress.status', 'progress.sub_status'),
  num_percent: function() {
    return Math.round(100 * (this.get('progress.percent') || 0));
  }.property('progress.percent'),
  num_style: function() {
    return new Ember.String.htmlSafe("width: " + this.get('num_percent') + "%;");
  }.property('num_percent'),
  download_type: function() {
    return this.get('model.type') != 'pdf';
  }.property('model.type')
});
