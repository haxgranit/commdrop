import Component from '@ember/component';
import $ from 'jquery';
import capabilities from '../utils/capabilities';
import buttonTracker from '../utils/raw_events';
import modal from '../utils/modal';
import { observer } from '@ember/object';

export default Component.extend({
  didRender: function() {
    this.stretch();
    if(!this.get('already_opened')) {
      this.set('already_opened', true);
      this.sendAction('opening');
    }
    this.set('auto_close', !!modal.auto_close);
    if(modal.last_any_template != 'highlight') {
      modal.component = this;
    }
    var height = $(window).height() - 50;
    $(this.get('element')).find(".modal-content").css('maxHeight', height).css('overflow', 'auto');
  },
  willClearRender: function() {
    this.set('already_opened', false);
  },
  stretch: observer('stretch_ratio', 'desired_width', function() {
    if(this.get('stretch_ratio')) {
      var height = $(window).height() - 50;
      var width = $(window).width();
      var modal_width = (width * 0.9);
      if(modal_width > height * this.get('stretch_ratio') * 0.9) {
        modal_width = height * this.get('stretch_ratio') * 0.9;
      }
      $(this.get('element')).find(".modal-dialog").css('width', modal_width);
    } else if(this.get('full_stretch')) {
      var height = $(window).height() - 50;
      var width = $(window).width();
      var modal_width = (width * 0.97);
      $(this.get('element')).find(".modal-dialog").css('width', modal_width);
    } else if(this.get('desired_width')) {
      var width = $(window).width();
      var modal_width = (width * 0.9);
      if(this.get('desired_width') < modal_width) {
        modal_width = this.get('desired_width');
      }
      $(this.get('element')).find(".modal-dialog").css('width', modal_width);
    } else {
      $(this.get('element')).find(".modal-dialog").css('width', '');
    }
  }),
  willDestroy: function() {
    if(!this.get('already_closed')) {
      this.set('already_closed', true);
      try {
        this.sendAction('closing');
      } catch(e) { }
    }
  },
  touchStart: function(event) {
    this.send('close', event);
  },
  mouseDown: function(event) {
    // on iOS (probably just UIWebView) this phantom
    // click event get triggered. If you tap & release 
    // really fast then tap somewhere else, right after
    // touchstart a click gets triggered at the location
    // you hit and released before.
    var ignore = false;
    var now = (new Date()).getTime();
    event.handled_at = now;
    if(buttonTracker.lastTouchStart) {
      if(capabilities.mobile && now - buttonTracker.lastTouchStart < 300) {
        ignore = true;
        event.fake_event = true;
      }
    }
    if(!ignore) {
      this.send('close', event);
    }
  },
  actions: {
    close: function(event) {
      if(!$(event.target).hasClass('modal')) {
        return;
      } else {
        try {
          event.preventDefault();
        } catch(e) { }
        console.log("close from event");
        buttonTracker.ignoreUp = true;
        return this.sendAction();
      }
    },
    any_select: function() {
      modal.cancel_auto_close();
    }
  }
});



