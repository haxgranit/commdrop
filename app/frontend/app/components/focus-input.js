import capabilities from '../utils/capabilities';
import TextField from '@ember/component/text-field';
import $ from 'jquery';
import { observer } from '@ember/object';

export default TextField.extend({
  becomeFocused: function() {
    if(!capabilities.mobile || this.get('force')) {
      $(this.element).focus().select();
    }
  }.on('didInsertElement'),
  focusOut: function() {
    this.sendAction();
  },
  keyDown: function(event) {
    if(event.keyCode == 13) {
      event.preventDefault();
      event.stopPropagation();
      if(this.get('select')) {
        this.sendAction('select');
      }
    }
  }
});
