import Ember from 'ember';
import buttonTracker from '../utils/raw_events';
import app_state from '../utils/app_state';
import editManager from '../utils/edit_manager';
import capabilities from '../utils/capabilities';

export default Ember.Component.extend({
  didInsertElement: function() {
    var _this = this;
    Ember.$(window).on('resize orientationchange', function() {
      Ember.run.later(function() {
        // on mobile devices, keyboard popup shouldn't trigger a redraw
        if(app_state.get('window_inner_width') && capabilities.mobile && window.innerWidth == app_state.get('window_inner_width')) {
          // TODO: do we need to force scrolltop to 0?
          return;
        }
        _this.sendAction('compute_height', true);
      }, 100);
    });
    _this.sendAction('compute_height');
  },
  buttonId: function(event) {
    var $button = Ember.$(event.target).closest('.button');
    return $button.attr('data-id');
  },
  buttonSelect: function(event) {
    var button_id = this.buttonId(event);
    if(app_state.get('edit_mode') && editManager.paint_mode) {
      this.buttonPaint(event);
    } else {
      this.sendAction('button_event', 'buttonSelect', button_id, event);
    }
  },
  buttonPaint: function(event) {
    if(editManager.paint_mode) {
      var button_id = this.buttonId(event);
      this.sendAction('button_event', 'buttonPaint', button_id);
    }
  },
  symbolSelect: function(event) {
    if(app_state.get('edit_mode')) {
      if(editManager.finding_target()) {
        return this.buttonSelect(event);
      }
      var button_id = this.buttonId(event);
      this.sendAction('button_event', 'symbolSelect', button_id);
    }
  },
  actionSelect: function(event) {
    if(app_state.get('edit_mode')) {
      if(editManager.finding_target()) {
        return this.buttonSelect(event);
      }
      var button_id = this.buttonId(event);
      this.sendAction('button_event', 'actionSelect', button_id);
    }
  },
  rearrange: function(event) {
    if(app_state.get('edit_mode')) {
      var dragId = Ember.$(event.target).data('drag_id');
      var dropId = Ember.$(event.target).data('drop_id');
      this.sendAction('button_event', 'rearrangeButtons', dragId, dropId);
    }
  },
  clear: function(event) {
    if(app_state.get('edit_mode')) {
      var button_id = this.buttonId(event);
      this.sendAction('button_event', 'clear_button', button_id);
    }
  },
  stash: function(event) {
    if(app_state.get('edit_mode')) {
      var button_id = this.buttonId(event);
      this.sendAction('button_event', 'stash_button', button_id);
    }
  }
});
