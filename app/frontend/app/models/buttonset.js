import Ember from 'ember';
import DS from 'ember-data';
import CoughDrop from '../app';
import i18n from '../utils/i18n';
import persistence from '../utils/persistence';
import stashes from '../utils/_stashes';
import Utils from '../utils/misc';

CoughDrop.Buttonset = DS.Model.extend({
  key: DS.attr('string'),
  buttons: DS.attr('raw'),
  find_buttons: function(str, user, include_home_and_sidebar) {
    if(str.length === 0) { return []; }
    var buttons = this.get('buttons') || [];
    var images = CoughDrop.store.peekAll('image');
    
    var matching_buttons = [];
    var re = new RegExp("\\b" + str, 'i');
    var all_buttons_enabled = stashes.get('all_buttons_enabled');
    buttons.forEach(function(button, idx) {
      // TODO: optionally show buttons on link-disabled boards
      if(!button.hidden || all_buttons_enabled) {
        if((button.label && button.label.match(re)) || (button.vocalization && button.vocalization.match(re))) {
          var image = images.findBy('id', button.image_id);
          if(image) {
            button.image = image.get('best_url');
          }
          Ember.set(button, 'image', Ember.get(button, 'image') || Ember.templateHelpers.path('blank.png'));
          Ember.set(button, 'on_this_board', (Ember.get(button, 'depth') === 0));
          var path = [];
          var depth = button.depth;
          var ref_button = button;
          var allow_unpreferred = false;
          var button_to_get_here = null;
          var check_for_match = function(parent_button) {
            if(!button_to_get_here && !parent_button.link_disabled && (!parent_button.hidden || all_buttons_enabled)) {
              if(parent_button.linked_board_id == ref_button.board_id && (allow_unpreferred || parent_button.preferred_link)) {
                button_to_get_here = parent_button;
              }
            }
          };
          var find_same_button = function(b) { return b.board_id == button_to_get_here.board_id && b.id == button_to_get_here.id; };
          while(depth > 0) {
            button_to_get_here = null;
            allow_unpreferred = false;
            buttons.forEach(check_for_match);
            allow_unpreferred = true;
            buttons.forEach(check_for_match);
            if(!button_to_get_here) {
              // something bad happened
              depth = -1;
            } else {
              ref_button = button_to_get_here;
              depth = ref_button.depth;
              // check for loops, fail immediately
              if(path.find(find_same_button)) {
                depth = -1;
              } else {
                path.unshift(button_to_get_here);
              }
            }
            // hard limit on number of steps
            if(path.length > 15) {
              depth = -1;
            }
          }
          if(depth >= 0) {
            Ember.set(button, 'pre_buttons', path);
            matching_buttons.push(button);
          }
        }
      }
    });
    
    var other_find_buttons = [];
    // TODO: include additional buttons if they are accessible from "home" or 
    // the "sidebar" button sets.
    if(include_home_and_sidebar && user && user.get('preferences.home_board.id')) {
      var boards = [CoughDrop.store.peekRecord('board', user.get('preferences.home_board.id'))];
      (user.get('preferences.sidebar_boards') || []).forEach(function(brd) {
        var board = CoughDrop.store.peekRecord('board', brd.key);
        if(board) {
          boards.push(board);
        }
      });
      boards.forEach(function(board, idx) {
        var is_home = (idx === 0);
        board.load_button_set();
        if(board.get('button_set')) {
          var button_set = board.get('button_set');
          var promise = button_set.find_buttons(str).then(function(buttons) {
            buttons.forEach(function(button) {
              button.meta_link = true;
              button.on_this_board = false;
              button.pre_buttons.unshift({
                'id': -1,
                'pre': is_home ? 'home' : 'sidebar',
                'board_id': is_home ? 'home' : 'sidebar',
                'board_key': is_home ? 'home' : 'sidebar',
                'linked_board_id': board.get('id'),
                'linked_board_key': board.get('key'),
                'label': is_home ? i18n.t('home', 'Home') : i18n.t('sidebar_board', "Sidebar, %{board_name}", {hash: {board_name: board.get('name')}})
              });
              matching_buttons.push(button);
            });
          });
          other_find_buttons.push(promise);
        }
      });
    }
    
    var image_lookups = Ember.RSVP.all_wait(other_find_buttons).then(function() {
      var image_lookup_promises = [];
      matching_buttons.forEach(function(button) {
        Ember.set(button, 'current_depth', (button.pre_buttons || []).length);
        if(button.image && button.image.match(/^http/)) {
          var promise = persistence.find_url(button.image, 'image').then(function(data_uri) {
            Ember.set(button, 'image', data_uri);
          }, function() { });
          image_lookup_promises.push(promise);
          promise.then(null, function() { });
        }
      });
      return Ember.RSVP.all_wait(image_lookup_promises);
    });
    
    return image_lookups.then(function() {
      matching_buttons = Utils.uniq(matching_buttons, function(b) { return (b.id || b.label) + "::" + b.board_id; });
      return matching_buttons.sort(function(a, b) {
        var a_depth = a.current_depth ? 1 : 0;
        var b_depth = b.current_depth ? 1 : 0;
        if(a_depth > b_depth) {
          return 1;
        } else if(a_depth < b_depth) {
          return -1;
        } else {
          if(a.label.toLowerCase() > b.label.toLowerCase()) {
            return 1;
          } else if(a.label.toLowerCase() < b.label.toLowerCase()) {
            return -1;
          } else {
            return 0;
          }
        }
      });
    });
  }
});

export default CoughDrop.Buttonset;