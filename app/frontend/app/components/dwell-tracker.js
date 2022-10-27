import Ember from 'ember';
import buttonTracker from '../utils/raw_events';
import capabilities from '../utils/capabilities';

export default Ember.Component.extend({
  draw: function() {
    var elem = this.get('element').getElementsByClassName('preview')[0];
    var coords = this.getProperties('screen_width', 'screen_height', 'event_x', 'event_y', 'window_x', 'window_y', 'window_width', 'window_height');
    if(elem && coords && coords.screen_width) {
      var context = elem.getContext('2d');
      var width = elem.width;
      var height = elem.height;
      context.clearRect(0, 0, width, height);
      if(this.get('current_dwell')) {
        context.fillStyle = '#eee';
        context.strokeStyle = '#444';
      } else {
        context.fillStyle = '#fee';
        context.strokeStyle = '#844';
      }
      context.beginPath();
      context.rect(0, 0, width, height);
      context.closePath();
      context.fill();
      context.stroke();


      var ctx_window_width = width * (coords.window_width / coords.screen_width);
      var ctx_window_height = height * (coords.window_height / coords.screen_height);
      var ctx_window_x = width * (coords.window_x / coords.screen_width);
      var ctx_window_y = height * (coords.window_y / coords.screen_height);
      if(this.get('current_dwell')) {
        context.fillStyle = '#fff';
        context.strokeStyle = '#444';
      } else {
        context.fillStyle = '#fff';
        context.strokeStyle = '#844';
      }
      context.beginPath();
      context.rect(ctx_window_x, ctx_window_y, ctx_window_width, ctx_window_height);
      context.closePath();
      context.fill();
      context.stroke();

      if(coords.event_x) {
        var ctx_point_x = width * (coords.event_x / coords.screen_width);
        var ctx_point_y = height * (coords.event_y / coords.screen_height);
        context.fillStyle = '#f00';
        context.beginPath();
        context.arc(ctx_point_x, ctx_point_y, 10, 0, 2*Math.PI);
        context.closePath();
        context.fill();
      }
    }
  }.observes('current_dwell', 'screen_width', 'screen_height', 'event_x', 'event_y', 'window_x', 'window_y', 'window_width', 'window_height'),
  didInsertElement: function() {
    var _this = this;

    _this.setProperties({
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      window_x: window.screenInnerOffsetX || window.screenX,
      window_y: window.screenInnerOffsetY || window.screenY,
      window_width: Ember.$(window).width(),
      window_height: Ember.$(window).height(),
    });

    capabilities.eye_gaze.listen();

    var eye_listener = function(e) {
      if(_this.get('user.preferences.device.dwell_type') == 'eyegaze') {
        var ratio = window.devicePixelRatio || 1.0;
        e.screenX = ratio * (e.clientX + (window.screenInnerOffsetX || window.screenX));
        e.screenY = ratio * (e.clientY + (window.screenInnerOffsetY || window.screenY));
        _this.setProperties({
          screen_width: window.screen.width,
          screen_height: window.screen.height,
          event_x: e.screenX,
          event_y: e.screenY,
          window_x: window.screenInnerOffsetX || window.screenX,
          window_y: window.screenInnerOffsetY || window.screenY,
          ts: (new Date()).getTime(),
          window_width: Ember.$(window).width(),
          window_height: Ember.$(window).height(),
        });
      }
    };
    this.set('eye_listener', eye_listener);
    document.addEventListener('gazelinger', eye_listener);

    var mouse_listener = function(e) {
      if(_this.get('user.preferences.device.dwell_type') == 'mouse_dwell') {
        _this.setProperties({
          screen_width: window.screen.width,
          screen_height: window.screen.height,
          event_x: e.screenX,
          event_y: e.screenY,
          window_x: window.screenInnerOffsetX || window.screenX,
          window_y: window.screenInnerOffsetY || window.screenY,
          ts: (new Date()).getTime(),
          window_width: Ember.$(window).width(),
          window_height: Ember.$(window).height(),
        });
      }
    };
    this.set('mouse_listener', mouse_listener);
    document.addEventListener('mousemove', mouse_listener);
    this.set('ts', (new Date()).getTime());
    _this.check_timeout();
  },
  check_timeout: function() {
    var _this = this;
    if(this.get('mouse_listener')) {
      var now = (new Date()).getTime();
      var ts = this.get('ts');
      console.log(now - ts);
      this.set('current_dwell', (ts && now - ts <= 2000));
      Ember.run.later(function() { _this.check_timeout(); }, 100);
    }
  },
  willDestroyElement: function() {
    capabilities.eye_gaze.listen();
    document.removeEventListener('mousemove', this.get('mouse_listener'));
    document.removeEventListener('gazelinger', this.get('eye_listener'));
    this.set('mouse_listener', null);
    this.set('eye_listener', null);
  }
});
