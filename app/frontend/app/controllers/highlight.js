import {
  debounce as runDebounce,
  later as runLater
} from '@ember/runloop';
import $ from 'jquery';
import modal from '../utils/modal';
import scanner from '../utils/scanner';
import buttonTracker from '../utils/raw_events';
import { htmlSafe } from '@ember/string';
import { observer } from '@ember/object';

export default modal.ModalController.extend({
  opening: function() {
    modal.highlight_controller = this;
    scanner.setup(this);
    var _this = this;
    runLater(function() {
      _this.compute_styles();
    }, 500);
    if(_this.recompute) {
      window.removeEventListener('resize', _this.recompute);
    }
    _this.recompute = function() {
      runDebounce(_this, _this.compute_styles, 500);
    };
    window.addEventListener('resize', _this.recompute);
  },
  closing: function() {
    window.removeEventListener('resize', this.recompute);
    this.recompute = null;
    modal.highlight_controller = null;
  },
  compute_styles: observer(
    'model.left',
    'model.top',
    'model.width',
    'model.height',
    'model.bottom',
    'model.right',
    'model.overlay',
    'model.clear_overlay',
    function() {
      var opacity = "0.3";
      var display = this.get('model.overlay') ? '' : 'display: none;';
      if(this.get('model.clear_overlay')) {
        opacity = "0.0";
      }
      var header_height = $("header").outerHeight();
      var window_height = $(window).outerHeight();
      var window_width = $(window).outerWidth();
      var top = this.get('model.top');
      var left = this.get('model.left');
      var bottom = this.get('model.bottom');
      var right = this.get('model.right');
      var width = this.get('model.width');
      var height = this.get('model.height');
      if(top < 4) {
        height = height - (4 - top);
        top = 4;
      }
      if(bottom > window_height - 4) {
        height = height - (bottom - (window_height - 4));
        bottom = window_height - 4;
      }
      if(left < 4) {
        width = width - (4 - left);
        left = 4;
      }
      if(right > window_width - 20) {
        width = width - (right - (window_width - 4));
        right = window_width - 4;
      }
      if(width > window_width - 8) {
        width = window_width - 8;
      }
      this.set('model.top_style', htmlSafe(display + "z-index: 2000; position: absolute; top: -" + header_height + "px; left: 0; background: #000; opacity: " + opacity + "; width: 100%; height: " + (top + header_height) + "px;"));
      this.set('model.left_style', htmlSafe(display + "z-index: 2000; position: absolute; top: " + (top) + "px; left: 0; background: #000; opacity: " + opacity + "; width: " + left + "px; height: " + height + "px;"));
      this.set('model.right_style', htmlSafe(display + "z-index: 2000; position: absolute; top: " + (top) + "px; left: calc(" + left+ "px + " + width + "px); background: #000; opacity: " + opacity + "; width: calc(100% - " + left + "px - " + width + "px); height: " + height + "px;"));
      this.set('model.bottom_style', htmlSafe(display + "z-index: 2000; position: absolute; top: " + (bottom) + "px; left: 0; background: #000; opacity: " + opacity + "; width: 100%; height: 5000px;"));
      this.set('model.highlight_style', htmlSafe("z-index: 2001; position: absolute; top: " + (top - 4) + "px; left: " + (left - 4) + "px; width: " + (width + 8) + "px; height: " + (height + 8) + "px; cursor: pointer;"));
      this.set('model.inner_highlight_style', htmlSafe("z-index: 2001; position: absolute; top: " + (top) + "px; left: " + left + "px; width: " + width + "px; height: " + height + "px; cursor: pointer;"));
      var icon_size = Math.min(Math.max(8, (height - 27) / 2), 75);
      this.set('model.icon_style', htmlSafe("font-size: " + icon_size + 'px;'));
    }
  ),
  actions: {
    select: function() {
      if(this.get('model.defer')) {
        this.get('model.defer').resolve();
      }
      if(!this.get('model.prevent_close')) {
        modal.close(null, 'highlight');
      }
    },
    select_release: function(e) {
      var $target = $(e.target);
      if($target.hasClass('highlight') && !$target.hasClass('inner')) {
        buttonTracker.ignoreUp = true;
        this.send('close');
      }
    },
    close: function() {
      if(this.get('close_handled')) { return; }
      this.set('close_handled', true);
      if(this.get('model.select_anywhere')) { // whole-screen is giant switch
        this.send('select');
      } else {
        if(this.get('model.defer')) {
          this.get('model.defer').reject();
        }
        if(!this.get('model.prevent_close')) {
          modal.close(null, 'highlight');
        }
      }
    },
    opening: function() {
      this.set('close_handled', false);
      var settings = modal.settings_for['highlight'] || {};
      var controller = this;
      modal.last_controller = controller;
      controller.set('model', settings);
      if(controller.opening) {
        controller.opening();
      }
    },
    closing: function() {
    }
  }
});
