import Ember from 'ember';

export default Ember.Component.extend({
  didInsertElement: function() {
    this.stretch();
    if(!this.get('already_opened')) {
      this.set('already_opened', true);
      this.sendAction('opening');
    }
//     var height = Ember.$(window).height() - 50;
//     Ember.$(this.get('parentView').get('element')).find(".modal-content").css('maxHeight', height);
  },
  stretch: function() {
    if(this.get('stretch_ratio')) {
      var height = Ember.$(window).height();
      var width = Ember.$(window).width();
      var modal_width = (width * 0.9);
      if(modal_width > height * this.get('stretch_ratio') * 0.9) {
        modal_width = height * this.get('stretch_ratio') * 0.9;
      }
      Ember.$(this.get('element')).find(".modal-dialog").css('width', modal_width);
    } else {
      Ember.$(this.get('element')).find(".modal-dialog").css('width', '');
    }
  }.observes('stretch_ratio'),
  willDestroy: function() {
    if(!this.get('already_closed')) {
      this.set('already_closed', true);
      this.sendAction('closing');
    }
  },
  touchStart: function(event) {
    this.send('close', event);
  },
  mouseDown: function(event) {
    this.send('close', event);
  },
  actions: {
    close: function(event) {
      if(!Ember.$(event.target).hasClass('modal')) {
        return;
      } else {
        event.preventDefault();
        return this.sendAction();
      }
    }
  }
});



