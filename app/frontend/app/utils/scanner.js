import Ember from 'ember';
import editManager from './edit_manager';
import modal from './modal';
import capabilities from './capabilities';
import app_state from './app_state';
import i18n from './i18n';
import speecher from './speecher';
import buttonTracker from './raw_events';
import frame_listener from './frame_listener';

var scanner = Ember.Object.extend({
  setup: function(controller) {
    this.controller = controller;
  },
  start: function(options) {
    if(Ember.$("header #speak").length === 0) {
      console.debug("scanning currently only works in speak mode...");
      scanner.stop();
      return;
    }
    var rows = [];
    options = options || this.last_options || {};
    this.last_options = options;
    options.scan_mode = options.scan_mode || "row";
    options.interval = options.interval || 1000;

    if(modal.is_open() && !modal.is_open('highlight')) {
      return;
    } else {
      var row = {
        children: [],
        dom: Ember.$("header"),
        label: i18n.t('header', "Header")
      };
      Ember.$("header #speak").find("button:visible,#button_list,a.btn").each(function() {
        var id_labels = {
          'home_button': i18n.t('home', "Home"),
          'back_button': i18n.t('back', "Back"),
          'button_list': i18n.t('speak', "Speak"),
          'speak_options': i18n.t('options', "Speak Options"),
          'backspace_button': i18n.t('backspace', "Backspace"),
          'clear_button': i18n.t('clear', "Clear")
        };
        var $elem = Ember.$(this);
        if($elem.attr('id') != 'speak_options') {
          var label = id_labels[$elem.attr('id')] || "";
          row.children.push({
            dom: $elem,
            label: label
          });
        }
      });

      var menu = {
        dom: Ember.$("#identity a.btn"),
        label: i18n.t('menu', "Menu"),
        children: []
      };
      Ember.$("#identity .dropdown-menu a").each(function() {
        var $option = Ember.$(this);
        menu.children.push({
          dom: $option,
          label: $option.text()
        });
      });
      row.children.push(menu);

      // TODO: figure out sidebar, when teaser is visible and also when the
      // whole sidebar is visible, including toggling between the two
  //     if(Ember.$("#sidebar_tease:visible").length) {
  //       row.children.push({
  //         dom: Ember.$("#sidebar_tease")
  //       });
  //     }
      rows.push(row);
      if(Ember.$("#word_suggestions").length) {
        var row = {
          children: [],
          dom: Ember.$("#word_suggestions"),
          label: i18n.t('suggestions', "Suggestions"),
          reload_children: function() {
            var res = [];
            Ember.$("#word_suggestions").find(".suggestion").each(function() {
              var $elem = Ember.$(this);
              res.push({
                dom: $elem,
                label: $elem.text()
              });
            });
            return res;
          }
        };
        row.children = row.reload_children();

        rows.push(row);
      }
      var content = scanner.scan_content();

      if(options.scan_mode == 'row' || options.scan_mode == 'button') {
        for(var idx = 0; idx < content.rows; idx++) {
          row = {
            children: [],
            dom: Ember.$(),
            label: i18n.t('row_n', "Row %{n}", {n: (idx + 1)})
          };
          for(var jdx = 0; jdx < content.columns; jdx++) {
            var $button = content.order[idx][jdx];
            if($button.length) {
              row.dom = row.dom.add($button);
              row.children.push({
                dom: $button,
                label: $button.label,
                sound: $button.sound
              });
            }
          }
          if(row.children.length > 0) {
            if(row.children.length == 1) {
              row = row.children[0];
            }
            rows.push(row);
          }
        }
        if(rows.length == 1) {
          rows = rows[0].children;
        }
      } else if(options.scan_mode == 'column') {
        for(var idx = 0; idx < content.columns; idx++) {
          var column = {
            children: [],
            dom: Ember.$(),
            label: i18n.t('column_n', "Column %{n}", {n: (idx + 1)})
          };
          for(var jdx = 0; jdx < content.rows; jdx++) {
            var $button = content.order[jdx][idx];
            if($button.length) {
              column.dom = column.dom.add($button);
              column.children.push({
                dom: $button,
                label: $button.label,
                sound: $button.sound
              });
            }
          }
          if(column.children.length > 0) {
            if(column.children.length == 1) {
              column = column.children[0];
            }
            rows.push(column);
          }
        }
        if(rows.length == 1) {
          rows = rows[0].children;
        }
      } else if(options.scan_mode == 'region') {
        var rows_per_chunk = options.rows_per_chunk;
        var columns_per_chunk = options.columns_per_chunk;
        var sub_scan = options.sub_scan_mode || 'horizontal';
        var vertical_chunks = Math.min(content.rows, options.vertical_chunks || Math.ceil(content.rows / (rows_per_chunk || 3)));
        var horizontal_chunks = Math.min(content.columns, options.horizontal_chunks || Math.ceil(content.columns / (columns_per_chunk || 3)));
        if(!rows_per_chunk || (rows_per_chunk < content.rows / vertical_chunks)) {
          rows_per_chunk = Math.max(Math.floor(content.rows / vertical_chunks), 1);
        }
        var leftover_rows = Math.max(content.rows - (rows_per_chunk * vertical_chunks), 0);
        if(!columns_per_chunk || (columns_per_chunk < content.columns / horizontal_chunks)) {
          columns_per_chunk = Math.max(Math.floor(content.columns / horizontal_chunks), 1);
        }
        var leftover_columns = Math.max(content.columns - (columns_per_chunk * horizontal_chunks), 0);
        if(sub_scan == 'vertical' || true) {
          for(var idx = 0; idx < horizontal_chunks; idx++) {
            for(var jdx = 0; jdx < vertical_chunks; jdx++) {
              var chunk = {
                children: [],
                dom: Ember.$(),
                label: i18n.t('region_n', "Region %{n}", {n: ((idx * vertical_chunks) + jdx + 1)})
              };
              var n_columns = columns_per_chunk;
              if(idx == horizontal_chunks - 1) { n_columns = n_columns + leftover_columns; }
              var n_rows = rows_per_chunk;
              if(jdx == vertical_chunks - 1) { n_rows = n_rows + leftover_rows; }
              for(var kdx = 0; kdx < n_columns; kdx++) {
                for(var ldx = 0; ldx < n_rows; ldx++) {
                  var r = content.order[(jdx * rows_per_chunk) + ldx];
                  if(r) {
                    var elem = r[(idx * columns_per_chunk) + kdx];
                    if(elem) {
                      var $button = elem;
                      if($button.length) {
                        chunk.dom = chunk.dom.add($button);
                        chunk.children.push({
                          dom: $button,
                          label: $button.label,
                          sound: $button.sound
                        });
                      }
                    }
                  }
                }
              }
              if(chunk.children.length > 0) {
                if(chunk.children.length == 1) {
                  chunk = chunk.children[0];
                }
                rows.push(chunk);
              }
            }
          }
        } else {
          for(var idx = 0; idx < vertical_chunks; idx++) {
            for(var jdx = 0; jdx < horizontal_chunks; jdx++) {
              var chunk = {
                children: [],
                dom: Ember.$(),
                label: i18n.t('region_n', "Region %{n}", {n: ((idx * horizontal_chunks) + jdx + 1)})
              };
              for(var kdx = 0; kdx < rows_per_chunk; kdx++) {
                for(var ldx = 0; ldx < columns_per_chunk; ldx++) {
                  var r = content.order[(idx * rows_per_chunk) + kdx];
                  if(r) {
                    var elem = r[(jdx * columns_per_chunk) + ldx];
                    if(elem) {
                      var $button = elem;
                      if($button.length) {
                        var label = $button.label || "";
                        chunk.dom = chunk.dom.add($button);
                        chunk.children.push({
                          dom: $button,
                          label: $button.label,
                          sound: $button.sound
                        });
                      }
                    }
                  }
                }
              }
              if(chunk.children.length > 0) {
                if(chunk.children.length == 1) {
                  chunk = chunk.children[0];
                }
                rows.push(chunk);
              }
            }
          }
        }
        if(rows.length == 1) {
          rows = rows[0].children;
        }
      }
      if(options.scan_mode == 'button') {
        var new_rows = [];
        rows.forEach(function(row) {
          if(row.children) {
            row.children.forEach(function(elem) {
              new_rows.push(elem);
            });
          } else {
            new_rows.push(row);
          }
        });
        rows = new_rows;
      }
    }
    this.scanning = true;
    this.scan_elements(rows, options);
  },
  scan_content: function() {
    if(frame_listener.visible()) {
      var res = {};
      res.rows = 1;
      var items = frame_listener.active_targets() || [];
      res.columns = items.length;
      res.order = [];
      res.order[0] = [];
      items.forEach(function(item, idx) {
        var $elem = Ember.$(item.dom);
        $elem.label = item.target.prompt || i18n.t('target_n', "target %{n}", {n: idx + 1});
        res.order[0].push($elem);
      });
      return res;
    } else {
      var grid = editManager.controller.get('model.grid');
      var res = {};
      res.rows = grid.rows;
      res.columns = grid.columns;
      res.order = [];
      for(var idx = 0; idx < grid.order.length; idx++) {
        res.order[idx] = [];
        for(var jdx = 0; jdx < grid.order[idx].length; jdx++) {
          var $button = Ember.$(".button[data-id='" + grid[idx][jdx] + "']:not(.hidden_button)");
          var button = editManager.find_button(grid[idx][jdx]);
          $button.label = (button && (button.get('vocalization') || button.get('label'))) || "";
          $button.soudn = button && button.get('sound');
          res.order[idx][jdx] = $button;
        }
      }
      return res;
    }
  },
  reset: function() {
    Ember.run.cancel(scanner.interval);
    this.start();
  },
  stop: function()  {
    Ember.run.cancel(scanner.interval);
    this.scanning = false;
    modal.close_highlight();
  },
  scan_elements: function(elements, options) {
    this.elements = elements;
    this.options = options;
    this.element_index = 0;
    this.next_element();
  },
  pick: function() {
    var elem = scanner.current_element;
    if(!modal.highlight_controller || !elem) { return; }
    if(!elem.higher_level && elem.children && elem.children.length == 1) {
      elem = elem.children[0];
    }

    buttonTracker.track_selection({
      event_type: 'click',
      selection_type: 'scanner'
    });

    if(elem.dom && elem.dom.hasClass('integration_target')) {
      frame_listener.trigger_target_event(elem.dom[0], 'scanselect', 'select');
    }

    if(elem.dom && elem.dom.hasClass('btn') && elem.dom.closest("#identity").length > 0) {
      var e = Ember.$.Event( "click" );
      e.pass_through = true;
      e.switch_activated = true;
      Ember.$(elem.dom).trigger(e);
      setTimeout(function() {
        Ember.$("#home_button").focus().select();
      }, 100);
    }

    if(elem.higher_level) {
      scanner.elements = elem.higher_level;
      scanner.element_index = elem.higher_level_index;
      Ember.run.cancel(scanner.interval);
      scanner.interval = Ember.run.later(function() {
        scanner.next_element();
      });
    } else if(elem.children) {
      scanner.load_children(elem, scanner.elements, scanner.element_index);
    } else if(elem.dom) {
      if(elem.dom.hasClass('button') && elem.dom.attr('data-id')) {
        var id = elem.dom.attr('data-id');
        var button = editManager.find_button(id);
        var app = app_state.controller;
        var board = app.get('board.model');
        app.activateButton(button, {image: button.get('image'), sound: button.get('sound'), board: board});
      } else if(elem.dom.hasClass('integration_target')) {
        frame_listener.trigger_target(elem.dom[0]);
      } else if(elem.dom.hasClass('button_list')) {
        elem.dom.select();
      } else {
        var e = Ember.$.Event( "click" );
        e.pass_through = true;
        Ember.$(elem.dom).trigger(e);
      }
      Ember.run.later(function() {
        scanner.reset();
      });
    }
  },
  load_children: function(elem, elements, index) {
    var parent = Ember.$.extend({higher_level: elements, higher_level_index: index}, elem);
    if(elem.reload_children) {
      elem.children = elem.reload_children();
    }
    scanner.elements = elem.children.concat([parent]);
    scanner.element_index = 0;
    Ember.run.cancel(scanner.interval);
    scanner.interval = Ember.run.later(function() {
      scanner.next_element();
    });
  },
  next: function() {
    Ember.run.cancel(scanner.interval);
    scanner.element_index = scanner.element_index + 1;
    if(scanner.element_index >= scanner.elements.length) {
      scanner.element_index = 0;
    }
    scanner.next_element();
  },
  next_element: function() {
    var elem = this.elements[this.element_index];
    if(!elem) {
      elem = elem || this.elements[0];
      this.element_index = 0;
    }
    if(!document.body.contains(elem.dom[0])) {
      var last = this.elements[this.elements.length - 1];
      if(last && last.higher_level && last.reload_children) {
        scanner.load_children(last.higher_level[last.higher_level_index], last.higher_level, last.higher_level_index);
        return;
      }
    }
    scanner.current_element = elem;
    var options = scanner.options;
    options.prevent_close = true;
    options.overlay = false;
    options.select_anywhere = true;
    if(scanner.options && scanner.options.focus_overlay) {
      options.overlay = true;
      options.clear_overlay = false;
    }

    if(this.options && this.options.audio) {
      if(elem && elem.sound) {
        speecher.speak_audio(elem.sound, 'text', false, {alternate_voice: true, interrupt: false});
      } else if(elem && elem.label) {
        var clean_label = (elem.label || "").replace(/^[\+\:]/, '');
        speecher.speak_text(clean_label, false, {alternate_voice: true, interrupt: false});
      }
    }
    if(capabilities.mobile && capabilities.installed_app && app_state.get('speak_mode') && Ember.$("#hidden_input:focus").length === 0) {
      modal.warning(i18n.t('tap_first', "Your switch may not be completely enabled. Tap somewhere on the screen to finish enabling it."), true);
    }
    if(elem.dom.hasClass('integration_target')) {
      frame_listener.trigger_target_event(elem.dom[0], 'scanover', 'over');
    }
    modal.highlight(elem.dom, options).then(function() {
      scanner.pick();
    }, function() { });
    scanner.interval = Ember.run.later(function() {
      if(scanner.current_element == elem) {
        scanner.next();
      }
    }, this.options.interval);
  }
}).create();

export default scanner;
