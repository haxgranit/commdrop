import Ember from 'ember';
import CoughDrop from '../app';
import boundClasses from './bound_classes';
import app_state from './app_state';
import persistence from './persistence';
import i18n from './i18n';
import stashes from './_stashes';

var BoardHierarchy = Ember.Object.extend({
  init: function() {
    var _this = this;
    var board = this.get('board');
    var button_set = this.get('button_set');
    var traversed_boards = {};
    var all_boards = [];
    var traverse_board = function(board_id, board_key) {
      var hierarchy_board = Ember.Object.create({
        id: board_id,
        key: board_key,
        user_name: board_key.split(/\//)[0],
        selected: true,
        children: [],
        parent: null,
        clones: []
      });
      traversed_boards[board_id] = hierarchy_board;
      all_boards.push(hierarchy_board);
      hierarchy_board.addObserver('selected', function() {
        if(!this.get('selected')) {
          // set everything underneath to unselected as well
          _this.set_downstream(this, 'selected', false);
        } else {
          if(this.get('parent')) {
            this.set('parent.selected', true);
          }
          if(!this.get('open')) {
            // set everything underneath to selected as well
            _this.set_downstream(this, 'selected', true);
          }
        }
        var selected = this.get('selected');
        (this.get('clones') || []).forEach(function(brd) {
          brd.set('selected', selected);
        });
      });
      hierarchy_board.addObserver('open', function() {
        if(this.get('open') && this.get('parent')) {
          this.set('parent.open', true);
        }
      });
      hierarchy_board.set('visible', !!button_set.get('buttons').find(function(b) { return b.board_id == board_id; }));
      var linked_buttons = button_set.get('buttons').filter(function(b) { return b.board_id == board_id && b.linked_board_id; });
      linked_buttons.forEach(function(btn) {
        var linked_board = traversed_boards[btn.linked_board_id];
        if(!linked_board) {
          var sub_board = traverse_board(btn.linked_board_id, btn.linked_board_key);
          sub_board.set('parent', hierarchy_board);
          if(sub_board.get('user_name') != hierarchy_board.get('user_name')) {
            hierarchy_board.set('open', true);
          }
          traversed_boards[board_id].get('children').push(sub_board);
        } else {
          var clone = Ember.Object.create({
            already_linked: true,
            id: linked_board.get('id'),
            key: linked_board.get('key'),
            selected: linked_board.get('selected')
          });
          linked_board.get('clones').push(clone);
          hierarchy_board.get('children').push(clone);
        }
      });
      return hierarchy_board;
    };
    var root_board = traverse_board(board.get('id'), board.get('key'));
    this.set('all_boards', all_boards);
    this.set('root', root_board);
  },
  root_deselected: function() {
    return !this.get('root.selected');
  }.property('root.selected'),
  selected_board_ids: function() {
    var ids = [];
    this.get('all_boards').forEach(function(b) {
      if(b.get('selected') && !b.get('already_linked')) {
        ids.push(b.get('id'));
      }
    });
    return ids;
  },
  set_downstream(board, attribute, value) {
    var _this = this;
    if(!board) {
      board = this.get('root');
      board.set(attribute, value);
    }
    (board.get('children') || []).forEach(function(b) {
      b.set(attribute, value);
      _this.set_downstream(b, attribute, value);
    });
  },
  toggle: function(board_id, state) {
    this.get('all_boards').forEach(function(b) {
      if(b.get('id') == board_id || board_id == 'all') {
        state = (state === null || state === undefined) ? !b.get('open') : state;
        b.set('open', state);
      }
    });
  }
});
BoardHierarchy.load_with_button_set = function(board) {
  var reload_board = board.reload().then(null, function() {
  }, function(err) {
    return Ember.RSVP.reject(i18n.t('loading_board_failed', "Failed loading board for copying"));
  });

  var downstream = reload_board.then(function() {
    if(board.get('downstream_boards') > 0) {
      return board.load_button_set();
    } else {
      return Ember.RSVP.resolve();
    }
  });

  var load_hierarchy = downstream.then(function(button_set) {
    if(!button_set) {
      return Ember.RSVP.resolve(null);
    }
    return Ember.RSVP.resolve(BoardHierarchy.create({board: board, button_set: button_set}));
  }, function() {
    return Ember.RSVP.reject(i18n.t('loading_board_failed', "Failed loading board links for copying"));
  });

  return load_hierarchy;
};

export default BoardHierarchy;
