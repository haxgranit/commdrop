import Ember from 'ember';
import modal from '../utils/modal';
import app_state from '../utils/app_state';

export default Ember.Controller.extend({
  display_class: function() {
    var res = "alert alert-dismissable ";
    if(this.get('alert_type')) {
      res = res + this.get('alert_type');
    }
    return res;
  }.property('alert_type'),
  actions: {
    opening: function() {
      var settings = modal.settings_for['flash'];

      this.set('message', settings.text);
      var class_name = 'alert-info';
      if(settings.type == 'warning') { class_name = 'alert-warning'; }
      if(settings.type == 'error') { class_name = 'alert-danger'; }
      if(settings.type == 'success') { class_name = 'alert-success'; }
      var top = app_state.get('header_height');
      this.set('extra_styles', new Ember.String.htmlSafe(settings.below_header ? 'top: ' + top + 'px;' : ''));
      this.set('alert_type', class_name);
    },
    closing: function() {
    }
  }
});
