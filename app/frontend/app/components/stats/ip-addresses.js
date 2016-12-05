import Ember from 'ember';

export default Ember.Component.extend({
  elem_class: function() {
    if(this.get('side_by_side')) {
      return Ember.String.htmlSafe('col-sm-6');
    } else {
      return Ember.String.htmlSafe('col-sm-4');
    }
  }.property('side_by_side'),
  elem_style: function() {
    if(this.get('right_side')) {
      return Ember.String.htmlSafe('border-left: 1px solid #eee;');
    } else {
      return Ember.String.htmlSafe('');
    }
  }.property('right_side'),
  inner_elem_style: function() {
    if(this.get('side_by_side')) {
      return Ember.String.htmlSafe('padding-top: 24px; height: 200px; overflow: auto;');
    } else {
      return Ember.String.htmlSafe('padding-top: 24px; max-height: 350px; overflow: auto;');
    }
  }.property('side_by_side'),
  actions: {
    filter: function(ip) {
      this.sendAction('filter', 'location', ip.id);
    }
  }
});
