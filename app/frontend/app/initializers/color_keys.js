import Ember from 'ember';
import CoughDrop from '../app';
import app_state from '../utils/app_state';

export default {
  name: 'color_keys',
  initialize: function() {
    CoughDrop.keyed_colors.forEach(function(r) {
      if(!r.border) {
        var fill = window.tinycolor(r.fill);
        var border = fill.darken(30);
        r.border = border.toHexString();
      }
      r.style = new Ember.String.htmlSafe("border-color: " + r.border + "; background: " + r.fill + ";");
    });
    app_state.set('colored_keys', true);
  }
};
