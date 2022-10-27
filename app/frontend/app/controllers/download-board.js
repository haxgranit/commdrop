import modal from '../utils/modal';
import persistence from '../utils/persistence';
import i18n from '../utils/i18n';
import app_state from '../utils/app_state';
import progress_tracker from '../utils/progress_tracker';
import { htmlSafe } from '@ember/string';

export default modal.ModalController.extend({
  pdf_download: computed(function() {
    return this.get('model.type') == 'pdf';
  }).property('model.type'),
  obf_download: computed(function() {
    return this.get('model.type') == 'obf';
  }).property('model.type'),
  opening: function() {
    this.set('progress', null);
    this.set('track_id', null);

    if(app_state.get('currentUser.preferences.preferences.device.button_text_position')) {
      if(app_state.get('currentUser.preferences.preferences.device.button_text_position') == 'bottom') {
        this.set('text_below', true);
      } else {
        this.set('text_below', false);
      }
    }

    if(app_state.get('currentUser.preferences.preferences.symbol_background')) {
      if(app_state.get('currentUser.preferences.preferences.symbol_background') == 'white') {
        this.set('white_background', true);
      } else {
        this.set('white_background', false);
      }
    }
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
        if(!this.get('white_background') && !this.get('download_type')) {
          url = url + "&transparent_background=1";
        }
        if(app_state.get('currentUser.preferences.device.button_text_position') == 'text_only') {
          url = url + "&text_only=1";
        }
        if(app_state.get('currentUser.preferences.device.button_style')) {
          url = url + "&font=" + app_state.get('currentUser.preferences.device.button_style').replace(/(_caps|_small)$/, '');
          if((app_state.get('currentUser.preferences.device.button_style') || "").match(/_caps/)) {
            url = url + "&text_case=upper";
          } else if((app_state.get('currentUser.preferences.device.button_style') || "").match(/_small/)) {
            url = url + "&text_case=lower";
          }
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
    set_attribute: function(attr, val) {
      this.set(attr, val);
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
    return htmlSafe("width: " + this.get('num_percent') + "%;");
  }.property('num_percent'),
  multi_download_type: function() {
    return this.get('model.type') != 'pdf' && this.get('model.has_links');
  }.property('model.type', 'model.has_links'),
  single_download_type: function() {
    return this.get('model.type') != 'pdf' && !this.get('model.has_links');
  }.property('model.type', 'model.has_links')
});
