import Ember from 'ember';
import Component from '@ember/component';
import modal from '../utils/modal';
import i18n from '../utils/i18n';
import { htmlSafe } from '@ember/string';

export default Component.extend({
  didInsertElement: function() {
  },
  badge_container_style: function() {
    var res = '';
    if(this.get('big')) {
    } else if(this.get('inline')) {
      res = 'margin-top: -14px; text-align: right; opacity: 0.7;';
    } else {
      res = 'margin-top: -30px; margin-left: -10px; margin-bottom: -50px;';
    }
    return htmlSafe(res);
  }.property('big', 'inline'),
  image_style: function() {
    var res = '';
    if(this.get('big')) {
      res = 'height: 80px; width: 80px; object-fit: contain; object-position: center;';
    } else {
      res = 'height: 60px; width: 60px; object-fit: contain; object-position: center;';
    }
    return htmlSafe(res);
  }.property('big'),
  text_style: function() {
    var res = '';
    if(this.get('big')) {
      res = 'font-size: 30px; color: #000; vertical-align: middle; text-decoration: none;'
    } else {
      res = 'display: none;'
    }
    return htmlSafe(res);
  }.property('big'),
  actions: {
    badge_popup: function(user_id) {
      modal.open('badge-awarded', {badge: {id: this.get('badge.id')}});
    }
  }
});