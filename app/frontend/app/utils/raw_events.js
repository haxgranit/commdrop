import Ember from 'ember';
import editManager from './edit_manager';
import modal from './modal';
import capabilities from './capabilities';
import app_state from './app_state';
import scanner from './scanner';
import stashes from './_stashes';

// gotchas:
// - text boxes in edit mode should be clickable
// - backspace should only remove one item
// - PIN entry shouldn't double-add the selected number
// - identity dropdown should work, including picking an item in the
//   menu, and the menu auto-closing when somewhere else is hit
// - button_list should vocalize on select
// - hitting the action or image icon on a button while in edit
//   mode should open that mode, not general button settings
// - drag and drop to rearrange buttons should work
// - drag to clear/copy to stash should work
// - apply button from stash should work
// - click after short timeout even without mouseup should work
// - too-fast click should not work
// - painting should work
// - gaze_linger events should work

var $board_canvas = null;

Ember.$(document).on('mousedown touchstart', function(event) {
  if(buttonTracker.dwell_elem) {
    buttonTracker.clear_dwell();
    event.target = document.elementFromPoint(event.clientX, event.clientY);
  }
  buttonTracker.touch_start(event)  ;
  if(capabilities.mobile && event.type == 'touchstart' && app_state.get('speak_mode') && scanner.scanning) {
    Ember.$("#hidden_input").select().focus();
  }
}).on('gazelinger mousemove touchmove mousedown touchstart', function(event) {
  if(event.type == 'mousemove' || event.type == 'mousedown') {
    buttonTracker.mouse_used = true;
  }
  buttonTracker.touch_continue(event);
}).on('mouseup touchend touchcancel blur', function(event) {
  if((event.type == 'mouseup' || event.type == 'touchend' || event.type == 'touchcancel') && buttonTracker.dwell_elem) {
    buttonTracker.clear_dwell();
  }
  buttonTracker.touch_release(event);
}).on('keypress', '.button', function(event) {
  // basic keyboard navigation
  // if(app_state.get('edit_mode')) { return; }
  if(event.keyCode == 13 || event.keyCode == 32) {
    if(event.target.tagName != 'INPUT') {
      Ember.$(this).trigger('buttonselect');
    }
  }
}).on('keydown', function(event) {
  if(event.keyCode == 9) {
    $board_canvas = Ember.$("#board_canvas");
    if(!$board_canvas.data('focus_listener_set')) {
      $board_canvas.data('focus_listener_set', true);
      $board_canvas.on('focus', function(event) {
        // TODO: need a reliable way to figure out if this is getting reverse-tabbed into
        buttonTracker.focus_tab(true);
      });
    }
    if(event.target.tagName == 'CANVAS') {
      var handled = buttonTracker.move_tab(!event.shiftKey);
      if(handled) {
        event.preventDefault();
      }
    } else {
      buttonTracker.clear_tab();
    }
  } else if(event.keyCode == 13 || event.keyCode == 32) {
    if(event.target.tagName == 'CANVAS') {
      buttonTracker.select_tab();
    }
  }
}).on('keydown', function(event) {
  if(!buttonTracker.scanning_enabled) { return; }
  if(event.keyCode && event.keyCode == buttonTracker.select_keycode) { // spacebar key
    scanner.pick();
    event.preventDefault();
  } else if(event.keyCode && buttonTracker.any_select) {
    scanner.pick();
    event.preventDefault();
  } else if(event.keyCode && event.keyCode == buttonTracker.next_keycode) { // 1 key
    scanner.next();
    event.preventDefault();
  }
}).on('gazedwell', function(event) {
  var element_wrap = buttonTracker.find_selectable_under_event(event);
  if(element_wrap && element_wrap.button) {
    element_wrap.trigger('buttonselect');
  } else {
    Ember.$(this).trigger('click');
  }
}).on('keypress', '#button_list', function(event) {
  if(event.keyCode == 13 || event.keyCode == 32) {
    Ember.$(this).trigger('select');
  }
}).on('drop', '.button,.board_drop', function(event) {
  Ember.$('.button.drop_target,.board_drop.drop_target').removeClass('drop_target');
}).on('dragover', '.button', function(event) {
  event.preventDefault();
  if(app_state.get('edit_mode')) {
    Ember.$(this).addClass('drop_target');
  }
}).on('dragover', '.board_drop', function(event) {
  event.preventDefault();
  Ember.$(this).addClass('drop_target');
}).on('dragleave', '.button,.board_drop', function(event) {
  event.preventDefault();
  Ember.$(this).removeClass('drop_target');
}).on('mousedown touchstart', '.select_on_click', function(event) {
  Ember.$(this).focus().select();
  event.preventDefault();
});
Ember.$(document).on('click', "a[target='_blank']", function(event) {
  if(capabilities.installed_app) {
    event.preventDefault();
    window.open(event.target.href, capabilities.mobile ? '_system' : '_blank');
  }
});
Ember.$(window).on('blur', function(event) {
  Ember.run.cancel(buttonTracker.linger_clear_later);
  Ember.run.cancel(buttonTracker.linger_close_enough_later);
});

var buttonTracker = Ember.Object.extend({
  setup: function() {
    // cheap trick to get us ahead of the line in front of ember
    Ember.$("#within_ember").on('click', '.advanced_selection', function(event) {
      // we're basically replacing all click events by tracking up and down explicitly,
      // so we don't want any unintentional double-triggers
      if(event.pass_through) { return; }
      event.preventDefault();
      event.stopPropagation();
      // skip the ember listeners, but pass along for bootstrap dropdowns
      if(Ember.$(event.target).closest('.dropdown').length === 0) {
        Ember.$(document).trigger(Ember.$.Event(event));
      }
    });
  },
  touch_start: function(event) {
    // advanced_selection regions should be eating all click events and
    // instead manually interpreting touch and mouse events. that way we
    // can do magical things like "click" on starting/ending point
    if(Ember.$(event.target).closest('.advanced_selection').length > 0) {
      // doesn't need to be here, but since buttons are always using advanced_selection it's probably ok
      Ember.$(".touched").removeClass('touched');
      // this is to prevent ugly selected boxes that happen with dragging
      if(app_state.get('edit_mode') || app_state.get('speak_mode')) {
        if(!buttonTracker.ignored_region(event)) {
          event.preventDefault();
        }
        if(app_state.get('edit_mode')) {
          return;
        }
      }

      buttonTracker.stop_dragging();
      // track the starting point because we may be using it as the "click"
      // location, depending on the user's settings
      var button_wrap = buttonTracker.find_selectable_under_event(event);
      buttonTracker.initialTarget = button_wrap;
      if(buttonTracker.initialTarget) {
        buttonTracker.initialTarget.timestamp = (new Date()).getTime();
      }
      // doesn't need to be here, but since buttons are always using advanced_selection it's probably ok
      if(button_wrap) {
        button_wrap.addClass('touched');
      } else {
        app_state.get('board_virtual_dom').clear_touched();
      }
    }
  },
  // used for handling dragging
  touch_continue: function(event) {
    if(buttonTracker.transitioning) {
      event.preventDefault();
      return;
    }

    // not the best approach, but I was getting tired of all the selected text blue things when
    // testing dragging so I threw this in.
    if(buttonTracker.buttonDown && app_state.get('edit_mode') && (buttonTracker.drag || !buttonTracker.ignored_region(event))) {
      // TODO: this lookup should be a method instead of being hard-coded, like ignored_region
      if(Ember.$(event.target).closest("#sidebar,.modal").length === 0) {
        event.preventDefault();
      }
    }

    event = buttonTracker.normalize_event(event);
    buttonTracker.ignoreUp = false;
    if(event.screenX && event.clientX) {
      window.screenInnerOffsetY = event.screenY - event.clientY;
      window.screenInnerOffsetX = event.screenX - event.clientX;
      stashes.persist('screenInnerOffsetX', window.screenInnerOffsetX);
      stashes.persist('screenInnerOffsetY', window.screenInnerOffsetY);
    }
    if(event.type == 'touchstart' || event.type == 'mousedown' || event.type == 'touchmove') {
      buttonTracker.buttonDown = true;
    } else if(event.type == 'gazelinger' && buttonTracker.dwell_enabled) {
      buttonTracker.dwell_linger(event);
    } else if(event.type == 'mousemove' && buttonTracker.dwell_enabled && buttonTracker.dwell_type == 'mouse_dwell') {
      buttonTracker.dwell_linger(event);
    }
    if(!buttonTracker.buttonDown && !app_state.get('edit_mode')) {
      var button_wrap = buttonTracker.find_selectable_under_event(event);
      if(button_wrap) {
        button_wrap.addClass('hover');
        // TODO: this is not terribly performant, but I guess it doesn't matter
        // since it won't trigger much on mobile
        Ember.$("#board_canvas").css('cursor', 'pointer');
        if(app_state.get('default_mode') && button_wrap.dom) {
          var $stash_hover = Ember.$("#stash_hover");
          if($stash_hover.data('button_id') != button_wrap.id) {
            var offset = Ember.$(button_wrap.dom).offset();
            if(offset && offset.left) {
              $stash_hover.removeClass('on_button');
              $stash_hover.detach();
              $stash_hover.css({
                top: offset.top,
                left: offset.left
              });
              Ember.$(".board").before($stash_hover);
              Ember.run.later(function() {
                $stash_hover.addClass('on_button');
                editManager.stashed_button_id = button_wrap.id;
              });
            }
            $stash_hover.data('button_id', button_wrap.id);
          }
        }
      } else {
        if(Ember.$(event.target).closest("#stash_hover").length === 0) {
          Ember.$("#stash_hover").removeClass('on_button').data('button_id', null);
        }
        app_state.get('board_virtual_dom').clear_hover();
        Ember.$("#board_canvas").css('cursor', '');
      }
      return;
    }

    if(buttonTracker.buttonDown && buttonTracker.any_select && buttonTracker.scanning_enabled) {
      var width = Ember.$(window).width();
      if(event.clientX <= (width / 2)) {
        if(buttonTracker.left_screen_action == 'next') {
          return scanner.next();
        } else {
          return scanner.pick();
        }
      } else {
        if(buttonTracker.right_screen_action == 'next') {
          return scanner.next();
        } else {
          return scanner.pick();
        }
      }

    }
    if(buttonTracker.buttonDown && !Ember.$(event.target).hasClass('highlight')) {
      modal.close_highlight();
    }
    if(buttonTracker.buttonDown && editManager.paint_mode) {
      // touch drag events don't return the right 'this'.
      var elem_wrap = buttonTracker.button_from_point(event.clientX, event.clientY);
      var elem = document.elementFromPoint(event.clientX, event.clientY);
      if(elem_wrap && Ember.$(elem).closest(".board").length > 0) {
        event.preventDefault();
        event.stopPropagation();
        elem_wrap.trigger('buttonpaint');
      }
    } else if(buttonTracker.buttonDown) {
      var elem_wrap = buttonTracker.track_drag(event);
      if(event.type == 'touchstart' || event.type == 'mousedown') {
        buttonTracker.longPressEvent = event;
        Ember.run.cancel(buttonTracker.track_long_press.later);
        Ember.run.cancel(buttonTracker.track_short_press.later);
        if(buttonTracker.long_press_delay) {
          buttonTracker.track_long_press.later = Ember.run.later(buttonTracker, buttonTracker.track_long_press, buttonTracker.long_press_delay);
        }
        if(buttonTracker.short_press_delay) {
          buttonTracker.track_short_press.later = Ember.run.later(buttonTracker, buttonTracker.track_short_press, buttonTracker.short_press_delay);
        }
      } else {
        buttonTracker.longPressEvent = null;
      }
      Ember.$('.drag_button.btn-danger').removeClass('btn-danger');
      Ember.$('.drag_button.btn-info').removeClass('btn-info');
      if(buttonTracker.drag) {
        buttonTracker.drag.hide();
        var under = document.elementFromPoint(event.clientX, event.clientY);
        buttonTracker.drag.show();
        if(under) {
          if(under.id == 'edit_stash_button') {
            Ember.$(under).addClass('btn-info');
          } else if(under.id == 'edit_clear_button') {
            Ember.$(under).addClass('btn-danger');
          }
        }
      }
      if(!elem_wrap || !app_state.get('edit_mode')) {
      } else {
        // this is expensive, only do when the drop target has changed
        if(elem_wrap.dom && elem_wrap.dom != buttonTracker.drag.data('over')) {
          // clear existing placeholder if one already exists
          if(buttonTracker.drag.data('over')) {
            var $elem = Ember.$(buttonTracker.drag.data('elem'));
            var $over = Ember.$(buttonTracker.drag.data('over'));
            var $overClone = Ember.$(buttonTracker.drag.data('overClone'));
            $overClone.remove();
            $over.css('opacity', 1.0);
            // if back to original state then clear target settings
            if(elem_wrap.dom == buttonTracker.drag.data('elem')) {
              buttonTracker.drag.data('over', null);
              buttonTracker.drag.data('overClone', null);
              $elem.show();
            }
          }
          // remember which element you were last over, can skip all this if hasn't changed
          buttonTracker.drag.data('over', elem_wrap.dom);

          // $over is the current drop target, make a copy of it and put it in as a
          // placeholder where the dragged button used to live
          var $over = Ember.$(elem_wrap.dom);
          var for_folder = $over.find(".action_container.folder").length > 0;
          var $overClone = null;
          try {
            $overClone = $over.clone();
          } catch(e) { }
          if($overClone) {
            if(elem_wrap.dom == buttonTracker.drag.data('elem')) {
              $overClone.css('opacity', 0.0);
            } else {
              var opacity = for_folder ? 0.2 : 0.7;
              $overClone.css('opacity', opacity);
            }
            buttonTracker.drag.data('overClone', $overClone[0]);
            var $elem = Ember.$(buttonTracker.drag.data('elem'));
            if(!for_folder) {
              $over.css('opacity', 0.0);
            }
            $overClone.css({
              top: $elem.css('top'),
              left: $elem.css('left')
            });
            $elem.hide().after($overClone);
          }
        }
      }
      if(buttonTracker.drag) {
        buttonTracker.drag.css({position: 'absolute', left: event.pageX + buttonTracker.buttonAdjustX, top: event.pageY + buttonTracker.buttonAdjustY});
      }
    }
  },
  touch_release: function(event) {
    event = buttonTracker.normalize_event(event);

    // don't remember why this is important...
    buttonTracker.buttonDown = false;

    var selectable_wrap = buttonTracker.find_selectable_under_event(event);
    // if dragging a button, behavior is very different than otherwise
    if(buttonTracker.drag) {
      // hide the dragged button for a second to find what's underneath it
      buttonTracker.drag.hide();
      var under = document.elementFromPoint(event.clientX, event.clientY);
      // check to see if the button was dragged to one of the helps at the top
      if(under) {
        if(under.id == 'edit_clear_button') {
          Ember.$(buttonTracker.drag.data('elem')).trigger('clear');
        } else if(under.id == 'edit_stash_button') {
          Ember.$(buttonTracker.drag.data('elem')).trigger('stash');
        }
      }
      // remove the hover, stop hiding the original
      if(buttonTracker.drag.data('over')) {
        var $over = Ember.$(buttonTracker.drag.data('over'));
        var $overClone = Ember.$(buttonTracker.drag.data('overClone'));
        $overClone.remove();
        $over.css('opacity', 1.0);
      }
      Ember.$(buttonTracker.drag.data('elem')).css('opacity', 1.0).show();
      buttonTracker.drag.remove();
      // if it's on a different button, trigger the swap event
      var button_wrap = buttonTracker.find_button_under_event(event);
      if(button_wrap) {
        var dragId = buttonTracker.drag.attr('data-id');
        var dropId = button_wrap.id;
        button_wrap.data('drag_id', dragId);
        button_wrap.data('drop_id', dropId);
        button_wrap.trigger('rearrange');
      }
      buttonTracker.drag = null;
    } else if((selectable_wrap || buttonTracker.initialTarget) && !buttonTracker.ignored_region(event)) {
      // if it either started or ended on a selectable item then there's a
      // chance we need to trigger a 'click', so pass it along
      buttonTracker.buttonDown = true;
      buttonTracker.element_release(selectable_wrap, event);
//     } else if(event.type == 'touchend' && event.target.tagName == 'A' || event.target.tagName == 'BUTTON') {
//       event.preventDefault();
//       event.stopPropagation();
//       Ember.$(event.target).trigger('click');
    // TODO: if not advanced_selection, touch events (but not mouse events) should be
    // mapped to click events for faster activation. Maybe find a library for this..
    }
    editManager.release_stroke();
    buttonTracker.stop_dragging();
    buttonTracker.initialTarget = null;
    app_state.get('board_virtual_dom').clear_touched();
    Ember.$('.touched').removeClass('touched');
  },
  element_release: function(elem_wrap, event) {
    // don't remember why this is important, but I'm pretty sure it is
    if(buttonTracker.ignored_region(event)) {
      if(editManager.finding_target()) {
        buttonTracker.ignoreUp = true;
        event.preventDefault();
      } else {
        return;
      }
    }

    if(buttonTracker.drag || !buttonTracker.buttonDown || buttonTracker.ignoreUp) {
      // when dragging or nothing selected, do nothing
      buttonTracker.ignoreUp = false;
    } else if(editManager.finding_target()) {
      // if looking for a target and one is found, hit it
      if(((elem_wrap && elem_wrap.dom && elem_wrap.dom.className) || "").match(/button/)) {
        buttonTracker.button_release(elem_wrap, event);
      }
      // TODO: clear finding_target when selecting anywhere else, leaving edit mode, etc.
    } else if(buttonTracker.ignored_region(event) || buttonTracker.ignored_region(buttonTracker.startEvent)) {
      // if it's an ignored region, do nothing
    } else if(!app_state.get('edit_mode')) {
      // when not editing, use user's preferred selection logic for identifying and
      // selecting a button
      event.preventDefault();
      var ts = (new Date()).getTime();

      if(event.type != 'gazelinger' && !event.dwell_linger) {
        // Use start, end or average pointer location for selection
        buttonTracker.activation_location = buttonTracker.activation_location || window.user_preferences.any_user.activation_location;
        if(buttonTracker.activation_location == 'start') {
          elem_wrap = buttonTracker.initialTarget;
        } else if(buttonTracker.activation_location == 'average') {
          // TODO: implement weighted average. Sample pointer location
          // from start to release and find the most likely target, ideally
          // taking into account distance from center of each potential target.
        } else {
          if(Ember.$(event.target).closest('.advanced_selection') === 0) {
            return;
          }
        }
        // ignore presses that are too short
        if(buttonTracker.minimum_press && buttonTracker.initialTarget && (ts - buttonTracker.initialTarget.timestamp) < buttonTracker.minimum_press) {
          elem_wrap = null;
        }
      }

      // logic to prevent quick double-tap, seems like this was a fix for iOS problems
      // but it may no longer be necessary
      if(elem_wrap && elem_wrap.dom && buttonTracker.lastSelect != elem_wrap.dom) {
        event.preventDefault();
        buttonTracker.lastSelect = elem_wrap.dom;
        Ember.run.later(function() {
          if(buttonTracker.lastSelect == elem_wrap.dom) {
            buttonTracker.lastSelect = null;
          }
        }, 300);

        // different elements have different selection styles
        // TODO: standardize this more
        if(elem_wrap.dom.id == 'identity') {
          event.preventDefault();
          // click events are eaten by our listener above, unless you
          // explicitly tell it to pass them through
          var e = Ember.$.Event( "click" );
          e.clientX = event.clientX;
          e.clientY = event.clientY;
          e.pass_through = true;
          Ember.$(elem_wrap.dom).trigger(e);
        } else if(elem_wrap.dom.id == 'button_list') {
          event.preventDefault();
          var $elem = Ember.$(elem_wrap.dom);
          $elem.addClass('focus');
          Ember.run.later(function() {
            $elem.removeClass('focus');
          }, 500);
          $elem.trigger('select');
        } else if(elem_wrap.dom.tagName == 'A' && Ember.$(elem_wrap.dom).closest('#pin').length > 0) {
          event.preventDefault();
          Ember.$(elem_wrap.dom).trigger('select');
        } else if((elem_wrap.dom.className || "").match(/button/) || elem_wrap.virtual_button) {
          buttonTracker.button_release(elem_wrap, event);
        } else {
          event.preventDefault();
          // click events are eaten by our listener above, unless you
          // explicitly tell it to pass them through
          var e = Ember.$.Event( "click" );
          e.clientX = event.clientX;
          e.clientY = event.clientY;
          e.pass_through = true;
          Ember.$(elem_wrap.dom).trigger(e);
        }
      }
    } else if(app_state.get('edit_mode') && !editManager.paint_mode) {
      if(((elem_wrap && elem_wrap.dom && elem_wrap.dom.className) || "").match(/button/)) {
        buttonTracker.button_release(elem_wrap, event);
      }
    }

    // without this, applying a button from the stash causes the selected
    // button to be put in drag mode
    buttonTracker.buttonDown = false;
  },
  button_release: function(elem_wrap, event) {
    // buttons have a slightly-more advanced logic, because of all the selection
    // targets available in edit mode (image, action button, etc.) and the option
    // of applying stashed buttons/swapping buttons
    var $target = Ember.$(event.target);
    if(editManager.finding_target()) {
      elem_wrap.trigger('buttonselect');
    } else if(!app_state.get('edit_mode')) {
      elem_wrap.trigger_special('buttonselect', {clientX: event.clientX, clientY: event.clientY});
    } else if(app_state.get('edit_mode') && !editManager.paint_mode) {
      event.preventDefault();
      if($target.closest('.action').length > 0) {
        elem_wrap.trigger('actionselect');
      } else if($target.closest('.symbol').length > 0) {
        elem_wrap.trigger('symbolselect');
      } else {
        elem_wrap.trigger('buttonselect');
      }
    }
  },
  dwell_linger: function(event) {
    if(buttonTracker.dwell_wait) { return; }
    if(buttonTracker.last_triggering_dwell_event) {
      // after a selection, require a little bit of movement before recognizing input
      var last = buttonTracker.last_triggering_dwell_event;
      var needed_distance = buttonTracker.dwell_release_distance || 30;
      var diffX = Math.abs(event.clientX - last.clientX);
      var diffY = Math.abs(event.clientY - last.clientY);
      if(diffX < needed_distance && diffY < needed_distance) {
        return;
      }
    }
    buttonTracker.last_triggering_dwell_event = null;
    // - find the nearest selectable, with some liberal tolerance
    // - if we're already lingering
    //   - if we're outside the tolerance, start a new linger
    //   - otherwise average the linger's history and decide on the best candidate
    // - persist the current linger, record the starting timestamp
    // - if we've been lingering on the element for more than the cutoff, call element_release
    var elem_wrap = buttonTracker.find_selectable_under_event(event, true, false);
    if(elem_wrap && buttonTracker.dwell_ignore == elem_wrap.dom) {
      buttonTracker.dwell_ignore = null;
      return;
    }
    if(!buttonTracker.dwell_elem) {
      var elem = document.createElement('div');
      elem.id = 'linger';
      document.body.appendChild(elem);
      var spinner = document.createElement('div');
      spinner.className = 'spinner pie';
      elem.appendChild(spinner);
      var filler = document.createElement('div');
      filler.className = 'filler pie';
      elem.appendChild(filler);
      var mask = document.createElement('div');
      mask.className = 'mask';
      elem.appendChild(mask);
      buttonTracker.dwell_elem = elem;
      var icon = document.createElement('div');
      icon.id = 'dwell_icon';
      document.body.appendChild(icon);
      buttonTracker.dwell_icon_elem = icon;
    }
    if(buttonTracker.dwell_cursor) {
      buttonTracker.dwell_icon_elem.style.left = (event.clientX - 5) + "px";
      buttonTracker.dwell_icon_elem.style.top = (event.clientY - 5) + "px";
    }

    Ember.run.cancel(buttonTracker.linger_clear_later);
    Ember.run.cancel(buttonTracker.linger_close_enough_later);
    buttonTracker.dwell_timeout = buttonTracker.dwell_timeout || 1000;
    buttonTracker.dwell_animation = buttonTracker.dwell_animation || 'pie';
    var allowed_delay_between_events = Math.max(300, buttonTracker.dwell_timeout / 4);
    var minimum_interaction_window = 50;
    if(event.type == 'mousemove' && buttonTracker.dwell_no_cutoff) {
      allowed_delay_between_events = buttonTracker.dwell_timeout - minimum_interaction_window;
    }
    if(!buttonTracker.dwell_delay && buttonTracker.dwell_delay !== 0) {
      buttonTracker.dwell_delay = 100;
    }
    buttonTracker.linger_clear_later = Ember.run.later(function() {
      // clear the dwell icon if not dwell activity for a period of time
      buttonTracker.clear_dwell(elem_wrap && elem_wrap.dom);
    }, allowed_delay_between_events);

    var now = (new Date()).getTime();
    var duration = event.duration || 50;
    if(buttonTracker.last_dwell_linger) {
      // check if we're outside the screen bounds, or the timestamp bounds.
      // if so clear the object
      if(now - buttonTracker.last_dwell_linger.started > buttonTracker.dwell_timeout + 1000 - duration) {
        // if it's been too long since starting to track the dwell, start over
        buttonTracker.last_dwell_linger = null;
      } else if(now - buttonTracker.last_dwell_linger.updated > allowed_delay_between_events - duration) {
        // if it's been too long since the last dwell event, start over
        buttonTracker.last_dwell_linger = null;
      } else {
        // if it's outside the loose bounds to the last target, start over
        var bounds = buttonTracker.last_dwell_linger.loose_bounds();
        if(event.clientX < bounds.left || event.clientX > bounds.left + bounds.width ||
              event.clientY < bounds.top || event.clientY > bounds.top + bounds.height) {
          buttonTracker.last_dwell_linger = null;
        }
      }
    }
    if(elem_wrap && buttonTracker.last_dwell_linger && elem_wrap.dom == buttonTracker.last_dwell_linger.dom) {
      // if they're the same, we're rockin'
      buttonTracker.buttonDown = true;
    } else if(elem_wrap && buttonTracker.last_dwell_linger && elem_wrap.dom != buttonTracker.last_dwell_linger.dom) {
      // if there's a valid existing linger for a different element, decide between it and the new linger
      var old_bounds = buttonTracker.last_dwell_linger.loose_bounds();
      var new_bounds = elem_wrap.loose_bounds();
      var avg_x = event.clientX * 3, avg_y = event.clientY * 3;
      var tally = 3;
      buttonTracker.last_dwell_linger.events.forEach(function(e, idx, list) {
        var weight = 1.0;
        // weight later events slightly more, otherwise it gets impossible to break out
        if(idx > (list.length / 2)) { weight = 2.0; }
        avg_x = avg_x + (e.clientX * weight);
        avg_y = avg_y + (e.clientY * weight);
        tally = tally + (1 * weight);
      });
      avg_x = avg_x / tally;
      avg_y = avg_y / tally;
      // cheap but less-accurate comparison
      var old_dist = (Math.abs(old_bounds.left + (old_bounds.width / 2) - avg_x) + Math.abs(old_bounds.top + (old_bounds.height / 2) - avg_y)) / 2;
      var new_dist = (Math.abs(new_bounds.left + (new_bounds.width / 2) - avg_x) + Math.abs(new_bounds.top + (new_bounds.height / 2) - avg_y)) / 2;
      if(new_dist < old_dist) {
        buttonTracker.last_dwell_linger = elem_wrap;
      }
    } else if(elem_wrap) {
      buttonTracker.last_dwell_linger = elem_wrap;
    }
    if(buttonTracker.last_dwell_linger) {
      // place the dwell icon in the center of the current linger
      if(!buttonTracker.last_dwell_linger.started) {
        // restart the excited doing-something animation
        buttonTracker.last_dwell_linger.started = now;
        var bounds = buttonTracker.last_dwell_linger.loose_bounds();
        buttonTracker.dwell_elem.style.left = (bounds.left + (bounds.width / 2) - 25) + "px";
        buttonTracker.dwell_elem.style.top = (bounds.top + (bounds.height / 2) - 25) + "px";
        // restart the animation
        var clone = buttonTracker.dwell_elem.cloneNode(true);
        clone.style.animationDuration = buttonTracker.dwell_timeout + 'ms';
        clone.style.webkitAnimationDuration = buttonTracker.dwell_timeout + 'ms';
        buttonTracker.dwell_elem.parentNode.replaceChild(clone, buttonTracker.dwell_elem);
        clone.classList.add('targeting');
        clone.classList.add(buttonTracker.dwell_animation);
        buttonTracker.dwell_elem = clone;
      }

      buttonTracker.last_dwell_linger.updated = now;
      buttonTracker.last_dwell_linger.events = buttonTracker.last_dwell_linger.events || [];
      buttonTracker.last_dwell_linger.events.push(event);
      // trigger selection if dwell has been for long enough
      if(now - buttonTracker.last_dwell_linger.started > buttonTracker.dwell_timeout) {
        event.dwell_linger = true;
        buttonTracker.element_release(buttonTracker.last_dwell_linger, event);
        buttonTracker.last_triggering_dwell_event = event;
        buttonTracker.last_dwell_linger = null;
        if(buttonTracker.dwell_delay) {
          buttonTracker.dwell_wait = true;
          Ember.run.later(function() {
            buttonTracker.dwell_wait = false;
          }, buttonTracker.dwell_delay);
        }
      } else {
        // if we're getting close to the dwell timeout, schedule a listener to trigger
        // it in case we don't get a follow-on event in time
        var will_trigger_at = buttonTracker.last_dwell_linger.started + buttonTracker.dwell_timeout;
        var ms_since_start = now - buttonTracker.last_dwell_linger.started;
        var ms_until_trigger = will_trigger_at - now;
        if((event.type == 'mousemove' && buttonTracker.dwell_no_cutoff && ms_since_start > minimum_interaction_window) || (ms_until_trigger < allowed_delay_between_events * 3 / 4)) {
          buttonTracker.linger_close_enough_later = Ember.run.later(function() {
            buttonTracker.dwell_linger(event);
          }, ms_until_trigger - 50);
        }
      }
    } else {
      // stick the dwell icon wherever it goes, with a sad nothing-here styling
      buttonTracker.dwell_elem.classList.remove('targeting');
      buttonTracker.dwell_elem.style.left = (event.clientX - 25) + "px";
      buttonTracker.dwell_elem.style.top = (event.clientY - 25) + "px";
    }
  },
  find_selectable_under_event: function(event, loose, allow_dwell) {
    event = buttonTracker.normalize_event(event);
    if(event.clientX === undefined || event.clientY === undefined) { return null; }
    var left = 0;
    if(buttonTracker.dwell_elem) {
      var left = buttonTracker.dwell_elem.style.left;
      buttonTracker.dwell_elem.style.left = '-1000px';
    }
    var $target = Ember.$(document.elementFromPoint(event.clientX, event.clientY));
    if(buttonTracker.dwell_elem) {
      buttonTracker.dwell_elem.style.left = left;
    }
    var region = $target.closest(".advanced_selection")[0];
    if(!region && loose) {
      // TODO: check the loose bounds of all the selectable elements, see if
      // you're close to anything selectable
    }
    if(region) {
      if(allow_dwell === false && $target.closest('.undwellable').length > 0) {
        return null;
      }
      if(region.id == 'pin') {
        return buttonTracker.element_wrap($target.closest("a")[0]);
      } else if(region.id == 'word_suggestions') {
        return buttonTracker.element_wrap($target.closest("a")[0]);
      } else if(region.id == 'identity') {
        if($target.closest('a').length > 0) {
          return buttonTracker.element_wrap($target.closest('a')[0]);
        } else {
          return buttonTracker.element_wrap(Ember.$(region).find(".dropdown > a"));
        }
      } else if(region.id == 'sidebar_tease') {
        return buttonTracker.element_wrap(region);
      } else if(region.id == 'sidebar') {
        return buttonTracker.element_wrap($target.closest(".btn,a")[0]);
      } else if(region.tagName == 'HEADER') {
        return buttonTracker.element_wrap($target.closest(".btn,#button_list")[0]);
      } else if((region.className || "").match(/board/) || region.id == 'board_canvas') {
        return buttonTracker.button_from_point(event.clientX, event.clientY);
      }
    }
    return null;
  },
  button_from_point: function(x, y) {
    // TODO: support virtual board dom
    var elem_left = null;
    if(buttonTracker.dwell_elem) {
      elem_left = buttonTracker.dwell_elem.style.left;
      buttonTracker.dwell_elem.style.left = '-1000px';
    }
    var elem = document.elementFromPoint(x, y);
    if(buttonTracker.dwell_elem) {
      buttonTracker.dwell_elem.style.left = elem_left;
    }

    var $target = Ember.$(elem).closest('.button');
    if($target.length > 0) {
      return buttonTracker.element_wrap($target[0]);
    } else if(app_state.get('speak_mode')) {
      // used for finding via the virtual dom
      var $board = Ember.$(".board");
      if($board.length === 0) { return null; }
      var offset = $board.offset() || {};
      var top = offset.top;
      if(top) {
        var button = app_state.get('board_virtual_dom').button_from_point(x, y - top - 3);
        return buttonTracker.element_wrap(button);
      }
    }
  },
  element_wrap: function(elem) {
    if(!elem) { return null; }
    var res = null;
    if(elem.button) {
      res = {
        id: elem.id,
        dom: elem.id,
        index: elem.index,
        virtual_button: true,
        addClass: function(str) {
          app_state.get('board_virtual_dom').add_state(str, elem.id);
        },
        trigger: function(event) {
          app_state.get('board_virtual_dom').trigger(event, elem.id);
        },
        trigger_special: function(event, args) {
          app_state.get('board_virtual_dom').trigger(event, elem.id, args);
        },
        loose_bounds: function() {
          return {
            width: elem.width + 100,
            height: elem.height + 100,
            top: elem.top - 50,
            left: elem.left - 50
          };
        },
        data: function(attr, val) {
          if(arguments.length == 2) {
            Ember.set(elem, attr, val);
          } else {
            return Ember.get(elem, attr);
          }
        }
      };
    } else {
      var $e = Ember.$(elem);
      res = {
        id: $e.attr('data-id'),
        dom: elem,
        addClass: function(str) {
          $e.addClass(str);
        },
        trigger: function(event) {
          $e.trigger(event);
        },
        trigger_special: function(event, args) {
          var e = Ember.$.Event( event );
          for(var idx in args) {
            e[idx] = args[idx];
          }
          $e.trigger(e);
        },
        loose_bounds: function() {
          if(res.cached_loose_bounds) { return res.cached_loose_bounds; }
          var offset = {};
          if($e.length > 0) { offset = $e.offset() || {}; }
          res.cached_loose_bounds = {
            width: $e.outerWidth() + 100,
            height: $e.outerHeight() + 100,
            top: offset.top - 50,
            left: offset.left - 50
          };
          return res.cached_loose_bounds;
        },
        data: function(attr, val) {
          return $e.data(attr, val);
        }
      };
    }
    return res;
  },
  find_button_under_event: function(event, no_side_effects) {
    if(buttonTracker.drag) {
      buttonTracker.drag.hide();
    }
    // TODO: Don't just use the pointer location, use the middle of the button...
    // right now if you grab an edge and drag it feels weird when most of your button is over a
    // different button but it's not switching because your cursor hasn't gotten there yet.
    var x = event.clientX + (this.measureAdjustX || 0);
    var y = event.clientY + (this.measureAdjustY || 0);
    var result_wrap = buttonTracker.button_from_point(x, y);
    if(buttonTracker.drag && result_wrap && result_wrap.dom == buttonTracker.drag.data('overClone')) {
      result_wrap = buttonTracker.element_wrap(buttonTracker.drag.data('elem'));
    }
    if(!no_side_effects) {
      if(buttonTracker.drag) {
        buttonTracker.drag.show();
      }
    }
    return result_wrap;
  },
  locate_button_on_board: function(id, event) {
    var x = null, y = null;
    if(event && event.clientX !== undefined && event.clientY !== undefined) {
      x = event.clientX;
      y = event.clientY;
    } else {
      // TODO: support virtual board dom
      var $button = Ember.$(".button[data-id='" + id + "']");
      if($button[0]) {
        var offset = $button.offset();
        x = offset.left + ($button.outerWidth() / 2);
        y = offset.top + ($button.outerHeight() / 2);
      } else {
        var button = app_state.get('board_virtual_dom').button_from_id(id);
        if(button) {
          x = button.left + (button.width / 2);
          y = button.top + (button.height / 2);
        }
      }
    }
    if(x && y) {
      var $board = Ember.$(".board");
      if($board.length) {
        var left = $board.offset().left;
        var top = $board.offset().top;
        var $sidebar = Ember.$("#sidebar");
        var sidebar_width = 0;
        if($sidebar.length > 0) {
          sidebar_width = $sidebar.outerWidth() || 0;
        }
        var width = $board.width() + left + sidebar_width;
        var height = $board.height() + top;
        var pct_x = (x - left) / width;
        var pct_y = (y - top) / height;
        return {percent_x: pct_x, percent_y: pct_y};
      }
    }
    return null;
  },
  track_drag: function(event) {
    this.startEvent = this.startEvent || event;
    var diffX = event.pageX - this.startEvent.pageX;
    var diffY = event.pageY - this.startEvent.pageY;
    var elem_wrap = null;

    if(Math.abs(event.pageX - this.startEvent.pageX) < this.drag_distance && Math.abs(event.pageY - this.startEvent.pageY) < this.drag_distance) {
      return;
    } else if(this.ignored_region(this.startEvent)) {
      return;
    }
    if(!buttonTracker.drag) {
      elem_wrap = this.find_button_under_event(this.startEvent);
      if(elem_wrap && elem_wrap.dom && app_state.get('edit_mode')) {
        var $elem = Ember.$(elem_wrap.dom);
        this.start_dragging($elem, this.startEvent);
        $elem.css('opacity', 0.0);
      }
    } else {
      elem_wrap = this.find_button_under_event(event);
    }
    return elem_wrap;
  },
  clear_dwell: function(elem) {
    if(buttonTracker.dwell_elem) {
      if(elem) {
        buttonTracker.dwell_ignore = elem;
        Ember.run.later(function() {
          if(buttonTracker.dwell_ignore == elem) {
            buttonTracker.dwell_ignore = null;
          }
        }, 500);
      }

      buttonTracker.dwell_elem.classList.remove('targeting');
      buttonTracker.dwell_elem.style.left = '-1000px';
      buttonTracker.last_dwell_linger = null;
    }
    if(buttonTracker.dwell_icon_elem) {
      buttonTracker.dwell_icon_elem.style.left = '-1000px';
    }
  },
  start_dragging: function($elem, event) {
    // create drag element
    var width = $elem.outerWidth();
    var height = $elem.height();
    buttonTracker.drag = $elem.clone().addClass('clone');
    buttonTracker.drag.css({width: width, height: height, zIndex: 2});
    // buttonTracker.drag.find('.button').css('background', '#fff');
    buttonTracker.drag.data('elem', $elem[0]);
    Ember.$('body').append(buttonTracker.drag);

    editManager.set_drag_mode(true);
    var offset = $elem.offset();
    this.initialButtonX = offset.left;
    this.initialButtonY = offset.top;
    this.buttonAdjustX = this.initialButtonX - event.pageX;
    this.buttonAdjustY = this.initialButtonY - event.pageY;
    this.measureAdjustX = (this.initialButtonX + (width / 2)) - event.pageX;
    this.measureAdjustY = (this.initialButtonY + (height / 2)) - event.pageY;
  },
  stop_dragging: function() {
    editManager.set_drag_mode(false);
    this.startEvent = null;
    this.initialButtonX = 0;
    this.initialButtonY = 0;
    this.buttonAdjustX = 0;
    this.buttonAdjustY = 0;
    this.measureAdjustX = 0;
    this.measureAdjustY = 0;
    this.set('buttons', []);
    this.longPressEvent = null;
  },
  normalize_event: function(event) {
    if(event.originalEvent && event.originalEvent.touches && event.originalEvent.touches[0]) {
      event.pageX = event.originalEvent.touches[0].pageX;
      event.pageY = event.originalEvent.touches[0].pageY;
      event.clientX = event.originalEvent.touches[0].clientX;
      event.clientY = event.originalEvent.touches[0].clientY;
    }
    if(event.originalEvent && event.originalEvent.changedTouches && event.originalEvent.changedTouches[0]) {
      event.pageX = event.originalEvent.changedTouches[0].pageX;
      event.pageY = event.originalEvent.changedTouches[0].pageY;
      event.clientX = event.originalEvent.changedTouches[0].clientX;
      event.clientY = event.originalEvent.changedTouches[0].clientY;
    }
    return event;
  },
  ignored_region: function(event) {
    var target = event && event.target;
    var result = !!(target && (
                      target.tagName == 'INPUT' ||
                      target.className == 'dropdown-backdrop' ||
                      target.className == 'modal' ||
                      target.className == 'modal-dialog'
                    ));
    return result;
  },
  long_press_delay: 2500,
  track_long_press: function() {
    if(this.longPressEvent) {
      var button_wrap = this.find_button_under_event(this.longPressEvent);
      if(button_wrap) {
        this.ignoreUp = true;
        editManager.start_edit_mode();
      }
    }
  },
  track_short_press: function() {
    if(this.longPressEvent) {
      var selectable_wrap = this.find_selectable_under_event(this.longPressEvent, true);
      if(selectable_wrap) {
        var event = Ember.$.Event('touchend', this.longPressEvent.originalTarget);
        buttonTracker.element_release(selectable_wrap, event);
        this.ignoreUp = true;
      }
    }
  },
  focus_tab: function(from_start) {
    if(!buttonTracker.focus_wrap) {
      var b = app_state.get('board_virtual_dom').button_from_index(from_start ? 0 : -2);
      buttonTracker.focus_wrap = buttonTracker.element_wrap(b);
    }
    buttonTracker.focus_wrap.addClass('touched');
    // set focus for the current button, set current button to zero if none set
    // if shift_key is held down then we're coming in backwards, which is important to know
  },
  select_tab: function() {
    // trigger buttonselect for the current button
    buttonTracker.focus_wrap.trigger('buttonselect');
  },
  move_tab: function(forward) {
    // progress forward or backward to the adjacent button
    // return true if there is an adjacent button, if not then
    // clear the tab and return false
    if(buttonTracker.focus_wrap) {
      var b = app_state.get('board_virtual_dom').button_from_index(buttonTracker.focus_wrap.index + (forward ? 1 : -1));
      buttonTracker.focus_wrap = buttonTracker.element_wrap(b);
    }
    if(buttonTracker.focus_wrap) {
      buttonTracker.focus_wrap.addClass('touched');
    } else {
      buttonTracker.clear_tab();
    }
    return !!buttonTracker.focus_wrap;
  },
  clear_tab: function() {
    app_state.get('board_virtual_dom').clear_touched();
    buttonTracker.focus_wrap = null;
    // remove the current button state
  },
  drag_distance: 20,
  buttons: []
}).create();

export default buttonTracker;
