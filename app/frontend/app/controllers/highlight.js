import Ember from 'ember';
import modal from '../utils/modal';
import scanner from '../utils/scanner';

export default modal.ModalController.extend({
  opening: function() {
    modal.highlight_controller = this;
    scanner.setup(this);
  },
  closing: function() {
    modal.highlight_controller = null;
  },
  compute_styles: function() {
    var opacity = "0.3";
    var display = this.get('model.overlay') ? '' : 'display: none;';
    if(this.get('model.clear_overlay')) {
      opacity = "0.0";
    }
    var header_height = Ember.$("header").outerHeight();
    var window_height = Ember.$(window).height();
    var window_width = Ember.$(window).width();
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
    this.set('model.top_style', new Ember.Handlebars.SafeString(display + "z-index: 9; position: absolute; top: -" + header_height + "px; left: 0; background: #000; opacity: " + opacity + "; width: 100%; height: " + top + "px;"));
    this.set('model.left_style', new Ember.Handlebars.SafeString(display + "z-index: 9; position: absolute; top: " + (top - header_height) + "px; left: 0; background: #000; opacity: " + opacity + "; width: " + left + "px; height: " + height + "px;"));
    this.set('model.right_style', new Ember.Handlebars.SafeString(display + "z-index: 9; position: absolute; top: " + (top - header_height) + "px; left: calc(" + left+ "px + " + width + "px); background: #000; opacity: " + opacity + "; width: calc(100% - " + left + "px - " + width + "px); height: " + height + "px;"));
    this.set('model.bottom_style', new Ember.Handlebars.SafeString(display + "z-index: 9; position: absolute; top: " + (bottom - header_height) + "px; left: 0; background: #000; opacity: " + opacity + "; width: 100%; height: 5000px;"));
    this.set('model.highlight_style', new Ember.Handlebars.SafeString("z-index: 10; position: absolute; top: " + (top - header_height - 4) + "px; left: " + (left - 4) + "px; width: " + (width + 8) + "px; height: " + (height + 8) + "px; cursor: pointer;"));
    this.set('model.inner_highlight_style', new Ember.Handlebars.SafeString("z-index: 11; position: absolute; top: " + (top - header_height) + "px; left: " + left + "px; width: " + width + "px; height: " + height + "px; cursor: pointer;"));
  }.observes('model.left', 'model.top', 'model.width', 'model.height', 'model.bottom', 'model.right', 'model.overlay'),
  actions: {
    select: function() {
      if(this.get('model.defer')) {
        this.get('model.defer').resolve();
      }
      if(!this.get('model.prevent_close')) {
        modal.close();
      }
    },
    close: function() {
      if(this.get('model.select_anywhere')) { // whole-screen is giant switch
        this.send('model.select');
      } else {
        if(this.get('model.defer')) {
          this.get('model.defer').reject();
        }
        if(!this.get('model.prevent_close')) {
          modal.close();
        }
      }
    },
    opening: function() {
      var template = this.get('templateName') || this.get('renderedName') || this.constructor.toString().split(/:/)[1];
      var settings = modal.settings_for[template] || {};
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
