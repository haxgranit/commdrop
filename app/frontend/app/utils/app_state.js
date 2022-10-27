import Ember from 'ember';
import Route from '@ember/routing/route';
import EmberObject from '@ember/object';
import {
  set as emberSet,
  setProperties as setProperties,
  get as emberGet
} from '@ember/object';
import {
  later as runLater,
  cancel as runCancel,
  next as runNext
} from '@ember/runloop';
import RSVP from 'rsvp';
import $ from 'jquery';
import stashes from './_stashes';
import boundClasses from './bound_classes';
import utterance from './utterance';
import modal from './modal';
import CoughDrop from '../app';
import contentGrabbers from './content_grabbers';
import editManager from './edit_manager';
import buttonTracker from './raw_events';
import capabilities from './capabilities';
import scanner from './scanner';
import session from './session';
import speecher from './speecher';
import geolocation from './geo';
import i18n from './i18n';
import frame_listener from './frame_listener';
import Button from './button';
import { htmlSafe } from '@ember/string';
import { observer } from '@ember/object';
import { computed } from '@ember/object';

// tracks:
// current mode (edit mode, speak mode, default)
// whether the sidebar is enabled
// what the currently-visible board is
// who the currently-logged-in user is
// who we're acting as for speak mode
// whether logging is temporarily disabled
// "back button" history
var app_state = EmberObject.extend({
  setup: function(application) {
    application.register('cough_drop:app_state', app_state, { instantiate: false, singleton: true });
    $.each(['model', 'controller', 'view', 'route'], function(i, component) {
      application.inject(component, 'app_state', 'cough_drop:app_state');
    });
    this.set('browser', capabilities.browser);
    this.set('system', capabilities.system);
    this.set('button_list', []);
    this.set('stashes', stashes);
    this.set('geolocation', geolocation);
    this.set('installed_app', capabilities.installed_app);
    this.set('no_linky', capabilities.installed_app && capabilities.system == 'iOS');
    this.set('licenseOptions', CoughDrop.licenseOptions);
    this.set('device_name', capabilities.readable_device_name);
    var settings = window.domain_settings || {};
    settings.app_name = CoughDrop.app_name || settings.app_name || "CoughDrop";
    settings.company_name = CoughDrop.company_name || settings.company_name || "CoughDrop";
    this.set('domain_settings', settings);
    this.set('currentBoardState', null);
    var _this = this;
    this.set('version', window.app_version || 'unknown');
    var _this = this;

    capabilities.battery.listen(function(battery) {
      battery.level = Math.round(battery.level * 100);
      if(battery.level != _this.get('battery.level') || battery.charging !== _this.get('battery.charging')) {
        _this.set('battery', battery);
        _this.set('battery.progress_style', htmlSafe("width: " + parseInt(battery.level) + "%;"));
        _this.set('battery.low', battery.level < 30);
        _this.set('battery.really_low', battery.level < 15);
        if(battery.level <= 15 && !battery.charging) {
          _this.set('battery.progress_class', "progress-bar progress-bar-danger");
        } else if(battery.level <= 30 && !battery.charging) {
          _this.set('battery.progress_class', "progress-bar progress-bar-warning");
        } else {
          _this.set('battery.progress_class', "progress-bar progress-bar-success");
        }
      }
    });
    capabilities.ssid.listen(function(ssid) {
      _this.set('current_ssid', ssid);
    });
    capabilities.nfc.available().then(function(res) {
      if(res && res.background) {
        capabilities.nfc.listen('global', function(tag) {
          app_state.handle_tag(tag);
        }).then(null, function() {
          // TODO: error message stating NFC listening failed?
        })
      }
    });
    Button.load_actions();
//    speecher.check_for_upgrades();
    this.refresh_user();
  },
  reset: function() {
    this.set('currentBoardState', null);
    this.set('currentUser', null);
    this.set('sessionUser', null);
    this.set('speakModeUser', null);
    this.set('referenced_speak_mode_user', null);
    stashes.set('current_mode', 'default');
    stashes.set('root_board_state', null);
    stashes.set('boardHistory', []);
    stashes.set('browse_history', []);
    this.controller = null;
    this.route = null;
    modal.reset();
    boundClasses.clear();
  },
  setup_controller: function(route, controller) {
    this.route = route;
    this.controller = controller;
    if(!session.get('isAuthenticated') && capabilities.mobile && capabilities.browserless) {
      this.set('login_modal', true);
    } else if(!session.get('isAuthenticated') && !this.get('domain_settings.full_domain')) {
      this.set('login_index', true);
    }
    modal.setup(route);
    contentGrabbers.boardGrabber.transitioner = route;
    CoughDrop.controller = controller;
    stashes.controller = controller;
    boundClasses.setup();
//    controller.set('model', EmberObject.create());
    utterance.setup(controller);
    this.speak_mode_handlers();
    this.dom_changes_on_board_state_change();
    CoughDrop.session = route.get('session');
    modal.close();
    if(session.get('access_token')) {
      // this shouldn't run until the db is initialized, otherwise if the user is offline
      // or has a spotty connection, then looking up the user will not succeed, and
      // the app will force a logout unexpectedly.
      var find_user = function(last_try) {
        var find = CoughDrop.store.findRecord('user', 'self');

        find.then(function(user) {
          console.log("user initialization working..");
          var valid_user = RSVP.resolve(user);
          if(!session.get('as_user_id') && session.get('user_id') && session.get('user_id') != user.get('id')) {
            // mismatch due to a user being renamed
            valid_user = CoughDrop.store.findRecord('user', session.get('user_id'));
          } else if(session.get('as_user_id') && user.get('user_name') && session.get('as_user_id') != user.get('user_name')) {
            // mismatch due to a user being renamed
            valid_user = CoughDrop.store.findRecord('user', session.get('as_user_id'));
          }
          valid_user.then(function(user) {
            if(!user.get('fresh') && stashes.get('online')) {
              // if online, try reloading, but it's ok if you can't
              user.reload().then(function(user) {
                app_state.set('sessionUser', user);
              }, function() { });
            }
            app_state.set('sessionUser', user);

            if(stashes.get('speak_mode_user_id') || stashes.get('referenced_speak_mode_user_id')) {
              var ref_id = stashes.get('speak_mode_user_id') || stashes.get('referenced_speak_mode_user_id');
              CoughDrop.store.findRecord('user', ref_id).then(function(user) {
                if(stashes.get('speak_mode_user_id')) {
                  app_state.set('speakModeUser', user);
                }
                app_state.set('referenced_speak_mode_user', user);
              }, function() {
                console.error('failed trying to speak as ' + ref_id);
              });
            }
          });
        }, function(err) {
          if(stashes.get('current_mode') == 'edit') {
            controller.toggleMode('edit');
          }
          console.log(err);
          console.log(err.status);
          console.log(err.error);
          var do_logout = err.status == 400 && (err.error == 'Not authorized' || err.error == "Invalid token");
          console.log("will log out: " + (do_logout || last_try));
          console.error("user initialization failed");
          if(do_logout || last_try) {
            var error = null;
            if(last_try) {
              error = i18n.t('error_logging_in', "We couldn't retrieve your user account, please try logging back in");
            } else {
              error = i18n.t('session_expired', "This session has expired, please log back in");
            }
            session.force_logout(error);
          } else {
            runLater(function() {
              find_user(true);
            }, 1000);
          }
        });
      };
      if(session.get('access_token')) {
        find_user();
      }
    }
    session.addObserver('access_token', function() {
      runLater(function() {
        if(session.get('access_token')) {
          app_state.refresh_session_user();
        }
      }, 10);
    });
    // TODO: this is a dumb way to do this (remove the "loading..." message)...
    $('#loading_box').remove();
    $("body").removeClass('pretty_loader');
  },
  refresh_user: function() {
    var _this = this;
    runCancel(_this.refreshing_user);

    function refresh() {
      runCancel(_this.refreshing_user);
      _this.refreshing_user = runLater(function() {
        _this.refresh_user();
      }, 60000 * 15);
    }
    if(_this.get('currentUser') && _this.get('currentUser').reload) {
      _this.get('currentUser').reload().then(function() {
        refresh();
      }, function() {
        refresh();
      });
    } else {
      refresh();
    }
  },
  global_transition: function(transition) {
    if(transition.aborted) { return; }
    app_state.set('from_url', app_state.get('route._router.url') || app_state.get('route.router.url'));
    var from = [transition.from_name].concat(transition.from_params);
    // if(!from[0]) {
    //   // TODO: this should go away
    //   var rec = this.get('route._router._routerMicrolib.recognizer') || this.get('route.router._routerMicrolib.recognizer');
    //   var pieces = rec && rec.recognize(app_state.get('from_url'));
    //   if(pieces && pieces.length > 0) {
    //     var args = [pieces[pieces.length - 1].handler];
    //     var handle_piece = function(name) {
    //       args.push(piece.params[name]);
    //     };
    //     for(var idx = 0; idx < pieces.length; idx++) {
    //       var piece = pieces[idx];
    //       if(piece && piece.isDynamic) {
    //         (transition._router || transition.router).getHandler(piece.handler)._names.forEach(handle_piece);
    //       }
    //     }
    //     from = args;
    //   }
    // }
    if(from[0] && from[0] != 'board.index') {
      app_state.set('from_route', from);
    }
//     console.log("came from", app_state.get('from_route'));
    app_state.set('latest_board_id', null);
    app_state.set('login_modal', false);
    app_state.set('to_target', transition.to_route);
    var from_route = (app_state.get('from_route') || [])[0] || transition.from_route;
    if(transition.to_route == 'board.index' && (from_route == 'setup' || from_route == 'home-boards')) {
      app_state.set('set_as_root_board_state', true);
    }

    // On desktop, setting too soon causes a re-render, but on mobile
    // calling it too late does.
    if(capabilities.mobile) {
//       app_state.set('index_view', transition.to_route == 'index');
    }
    if(transition.to_route == 'board.index') {
      boundClasses.setup();
      var delay = app_state.get('currentUser.preferences.board_jump_delay') || window.user_preferences.any_user.board_jump_delay;
      CoughDrop.log.track('global transition handled');
      runLater(this, this.check_for_board_readiness, delay, 50);
    }
    var controller = this.controller;
    runLater(function() {
      if(controller && controller.updateTitle) {
        controller.updateTitle();
      }
    }, controller && controller.updateTitle ? 0 : 500);
    
    modal.close();
    modal.close_board_preview();
    if(app_state.get('edit_mode')) {
      // TODO: confirm leaving exit mode before continuing
      app_state.toggle_edit_mode();
    }
//           $(".hover_button").remove();
    this.set('hide_search', transition.to_route == 'search');
    if(transition.to_route != 'board.index') {
      app_state.set('currentBoardState', null);
    }
    if(!app_state.get('sessionUser') && session.get('isAuthenticated')) {
      app_state.refresh_session_user();
    }
    app_state.set('current_route', transition.to_route);
  },
  finish_global_transition: function() {
    app_state.set('already_homed', true);
    runNext(function() {
      var target = app_state.get('current_route');
//       app_state.set('index_view', target == 'index');
    });
    // footer was showing up too quickly and looking weird when the rest of the page hadn't
    // re-rendered yet.
    if(!this.get('currentBoardState')) {
      try {
        this.controller.set('footer', true);
        if(this.get('to_target') && this.get('to_target') != 'setup' && this.get('to_target') != 'home-boards') {
          this.controller.set('setup_footer', false);
          this.controller.set('simple_board_header', false);
        }
      } catch(e) { }
    }
    if(CoughDrop.embedded && !this.get('speak_mode')) {
      if(window.top && window.top != window.self) {
        window.top.location.replace(window.location);
      }
    }
  },
  check_for_protected_usage: observer('currentUser.preferences.protected_usage', function() {
    var protect_user = !!this.get('currentUser.preferences.protected_usage');
    if(window._trackJs) {
      window._trackJs.disabled = protect_user;
    }
    CoughDrop.protected_user = protect_user;
    stashes.persist('protected_user', protect_user);
  }),
  set_root_board_state: observer('set_as_root_board_state', 'currentBoardState', function() {
    // When browsing boards from the "select a home board" interface,
    // automatically set them as the temporary root board for browsing
    if(this.get('set_as_root_board_state') && this.get('currentBoardState')) {
      stashes.persist('board_level', this.get('currentBoardState.default_level'));
      console.log("root state", stashes.get('board_level'));
      stashes.persist('root_board_state', this.get('currentBoardState'));
      this.set('set_as_root_board_state', false);
    }
  }),
  current_board_level: computed('stashes.board_level', function() {
    return stashes.get('board_level') || 10;
  }),
  board_url: computed('currentBoardState.key', function() {
    if(this.get('currentBoardState.key')) {
      return htmlSafe((capabilities.api_host || (location.protocol + "//" + location.host)) + "/" + this.get('currentBoardState.key'));
    } else {
      return null;
    }
  }),
  domain_board_user_name: computed('domain_settings.board_user_name', function() {
    return this.get('domain_settings.board_user_name') || 'example';
  }),
  h1_class: computed('currentBoardState.id', 'from_route', 'edit_mode', function() {
    var res = "";
    if(this.get('currentBoardState.id')) {
      res = res + "with_board " ;
      if(this.get('from_route') && !this.get('edit_mode')) {
        res = res + "sr-only ";
      }
    }
    return htmlSafe(res);
  }),
  nav_header_class: computed('currentBoardState.id', 'from_route', function() {
    var res = "no_beta ";
    if(this.get('currentBoardState.id') && this.get('from_route') && !this.get('edit_mode')) {
      res = res + "board_done ";
    }
    return htmlSafe(res);
  }),
  set_latest_board_id: observer('currentBoardState.id', function() {
    this.set('latest_board_id', this.get('currentBoardState.id'));
  }),
  check_for_board_readiness: function(delay) {
    if(this.check_for_board_readiness.timer) {
      runCancel(this.check_for_board_readiness.timer);
    }
    var id = app_state.get('latest_board_id');
    if(id) {
      var $board = $(".board[data-id='" + id + "']");
      var $integration = $("#integration_frame");
      var _this = this;
      if($integration.length || ($board.length && $board.find(".button_row,canvas").length)) {
        runLater(function() {
          CoughDrop.log.track('done transitioning');
          buttonTracker.transitioning = false;
        }, delay);
        return;
      }
    }
    this.check_for_board_readiness.timer = runLater(this, this.check_for_board_readiness, delay, 100);
  },
  track_depth: function(type) {
    var actions = this.get('depth_actions') || {depth: 0};
    if(type == 'home') {
      // TODO: make sure not to count double-hits without any change in page
      if(actions.last_action != 'home') {
        actions.depth = 0;
      }
      actions.depth++;
    } else if(type == 'back') {
      actions.depth = Math.max(0, actions.depth - 1);
    } else if(type == 'clear') {
      actions.depth = 0;
    } else {
      actions.depth++;
    }
    actions.last_action = type;
    this.set('depth_actions', actions);
  },
  jump_to_board: function(new_state, old_state) {
    buttonTracker.transitioning = true;
    if(new_state && old_state && new_state.id && (new_state.id == old_state.id || new_state.key == old_state.key)) {
      // transition was getting stuck when staying on the same board
      buttonTracker.transitioning = false;
    }
    if(new_state && (new_state.source == 'sidebar' || new_state.source == 'swipe')) {
      stashes.persist('last_root', new_state);
    }
    var history = this.get_history();
    old_state = old_state || this.get('currentBoardState');
    if(stashes.get('board_level')) {
      old_state.level = stashes.get('board_level');
    }
    history.push(old_state);
    if(!this.get('eval_mode')) {
      stashes.log({
        action: 'open_board',
        previous_key: old_state,
        new_id: new_state
      });
    }
    if(new_state && new_state.home_lock) {
      this.set('temporary_root_board_key', new_state.key);
    }
    this.controller.send('hide_temporary_sidebar');
    this.set_history([].concat(history));
    if(new_state.level) {
      stashes.persist('board_level', new_state.level);
    }
    this.set('referenced_board', new_state);
    this.controller.transitionToRoute('board', new_state.key);
  },
  check_for_lock_on_board_state: observer('currentBoardState', function() {
    var state = this.get('currentBoardState');
    if(state && state.key) {
      if(state.key == this.get('temporary_root_board_key')) {
        this.toggle_home_lock(true);
      }
      this.set('temporary_root_board_key', null);
    }
  }),
  toggle_home_lock: function(force) {
    var state = stashes.get('root_board_state');
    var current = app_state.get('currentBoardState');
    if(force === false || (stashes.get('temporary_root_board_state') && force !== true)) {
      stashes.persist('temporary_root_board_state', null);
    } else {
      if(state && current && state.key != current.key) {
        stashes.persist('temporary_root_board_state', app_state.get('currentBoardState'));
        app_state.set_history([]);
      }
    }
  },
  toggle_modeling: function(enable) {
    if(enable === undefined || enable === null) {
      enable = !app_state.get('manual_modeling');
    }
    app_state.set('last_activation', (new Date()).getTime());
    app_state.set('manual_modeling', !!enable);
    if(enable) {
      app_state.set('modeling_started', (new Date()).getTime());
    }
  },
  update_modeling: observer('modeling', function() {
    if(this.get('modeling') !== undefined && this.get('modeling') !== null) {
      stashes.set('modeling', !!this.get('modeling'));
    }
  }),
  modeling: computed('manual_modeling', 'modeling_for_user', 'modeling_ts', function(ch) {
    var res = !!(this.get('manual_modeling') || this.get('modeling_for_user'));
    return res;
  }),
  modeling_for_user: computed('speak_mode', 'currentUser', 'referenced_speak_mode_user', function() {
    var res = this.get('speak_mode') && this.get('currentUser') && this.get('referenced_speak_mode_user') && app_state.get('currentUser.id') != this.get('referenced_speak_mode_user.id');
    var _this = this;
    // this is weird and hacky, but for some reason modeling wasn't reliably updating when modeling_for_user changed
    runLater(function() {
      _this.set('modeling_ts', (new Date()).getTime() + "_" + Math.random());
    });
    return !!res;
  }),
  auto_clear_modeling: observer('short_refresh_stamp', 'modeling', function() {
    if(this.get('manual_modeling')) {
      var now = (new Date()).getTime();
      if(!app_state.get('last_activation')) {
        app_state.set('last_activation', now);
      }
      // progressively get more aggressive at auto-clearing modeling flag
      var duration = now - app_state.get('modeling_started');
      // by default, clear manual modeling mode after 5 minutes of inactivity
      var cutoff = 5 * 60 * 1000;
      // if you've been modeling for more than 30 minutes, then auto-clear after
      // 5 seconds without modeling
      if(duration > (30 * 60 * 1000)) {
        cutoff = 5 * 1000;
      // if you've been modeling for 10-30 minutes, then auto-clear modeling after
      // 30 seconds of inactivity
      } else if(duration > (10 * 60 * 1000)) {
        cutoff = 30 * 1000;
      // if you've been modeling for 5-10 minutes, then auto-clear after 60 inactive seconds
      } else if(duration > (5 * 60 * 1000)) {
        cutoff = 60 * 1000;
      }
      if(now - app_state.get('last_activation') > cutoff) {
        app_state.toggle_modeling();
      }
    }
  }),
  back_one_board: function(opts) {
    opts = opts || {};
    var history = this.get_history();
    var state = history.pop();
    buttonTracker.transitioning = true;
    if(state && state.id && state.id == this.get('currentBoardState.id')) {
      buttonTracker.transitioning = false;
    }
    stashes.log({
      action: 'back',
      button_triggered: opts.button_triggered
    });
    this.set_history([].concat(history));
    if(state.level) {
      stashes.persist('board_level', state.level);
    }
    this.set('referenced_board', state);
    this.controller.transitionToRoute('board', state.key);
  },
  jump_to_root_board: function(options) {
    options = options || {};
    var index_as_fallback = options.index_as_fallback;
    var auto_home = options.auto_home;

    this.set_history([]);
    var current = this.get('currentBoardState');
    var state = stashes.get('temporary_root_board_state') || stashes.get('root_board_state');
    state = state || this.get('currentUser.preferences.home_board');

    var do_log = false;
    if(state && state.key) {
      if(app_state.get('currentBoardState.key') != state.key) {
        buttonTracker.transitioning = true;
        stashes.persist('board_level', state.level || state.default_level);
        this.set('referenced_board', state);
        this.controller.transitionToRoute('board', state.key);
        do_log = current && current.key && state.key != current.key;
      }
    } else if(index_as_fallback) {
      this.controller.transitionToRoute('index');
      do_log = current && current.key;
    }
    if(do_log) {
      stashes.log({
        action: (auto_home ? 'auto_home' : 'home'),
        button_triggered: options.button_triggered,
        new_id: {
          id: state.id,
          key: state.key
        }
      });
    }
  },
  jump_to_next(forward) {
    var jump_between_boards = true;
    if(jump_between_boards) {
      var last_root = stashes.get('last_root') || app_state.get('referenced_user.home_board') || {};
      var roots = [app_state.get('referenced_user.preferences.home_board') || {}];
      roots = roots.concat((app_state.get('current_sidebar_boards') || []).filter(function(i) { return i.key; }));
      var found = roots.find(function(r) { return r && ((r.key && r.key == last_root.key) || (r.id && r.id == last_root.id)); });
      var current = Math.max(0, roots.indexOf(found));
      if(forward) { current++; } else { current--; }
      if(current < 0) { current = roots[roots.length - 1]; }
      else if(current >= roots.length) { current = 0; }
      if(roots[current]) {
        var ref = Object.assign({}, roots[current]);
        ref.source = 'swipe';
        app_state.jump_to_board(ref);
      }
      // for the list of boards including home and sidebar, figure out
      // which board they jumped to using the sidebar/home/entering speak mode
      // and jump to the next one instead
    } else {
      // TODO: option to jump between communicators? Nah.
    }
  },
  toggle_speak_mode: function(decision) {
    if(decision) {
      modal.close(true);
    }
    var current = app_state.get('currentBoardState');
    var preferred = app_state.get('speakModeUser.preferences.home_board') || app_state.get('currentUser.preferences.home_board');
    if(preferred && current) {
      emberSet(preferred, 'text_direction', current.text_direction);
    }
    
    if(!app_state.get('speak_mode')) {
      // if it's in the speak-mode-user's board set, keep the original home board,
      // otherwise set the current board to home for now
      var user = app_state.get('speakModeUser') || app_state.get('currentUser');
      if(user && (user.get('stats.board_set_ids') || []).indexOf(app_state.get('currentBoardState.id')) >= 0) {
        decision = decision || 'rememberRealHome';
      } else {
        decision = decision || 'currentAsHome';
      }
    }

    if(!current || decision == 'goHome') {
      this.home_in_speak_mode();
    } else if(decision == 'goBrowsedHome') {
      this.toggle_mode('speak', {override_state: stashes.get('root_board_state') || preferred});
    } else if(stashes.get('current_mode') == 'speak') {
      if(this.get('embedded')) {
        modal.open('about-coughdrop', {no_exit: true});
      } else if(app_state.get('currentUser.preferences.require_speak_mode_pin') && decision != 'off' && app_state.get('currentUser.preferences.speak_mode_pin')) {
        modal.open('speak-mode-pin', {actual_pin: app_state.get('currentUser.preferences.speak_mode_pin')});
      } else {
        this.toggle_mode('speak');
      }
    } else if(decision == 'currentAsHome' || !preferred || (preferred && current && preferred.key == current.key)) {
      this.toggle_mode('speak', {temporary_home: true, override_state: preferred});
    } else if(decision == 'rememberRealHome') {
      this.toggle_mode('speak', {override_state: preferred});
    } else {
      this.controller.send('pickWhichHome');
    }
  },
  toggle_edit_mode: function(decision) {
    editManager.clear_history();
    var _this = this;
    if(!this.get('controller.board.model.permissions.edit')) {
      modal.open('confirm-needs-copying', {board: this.controller.get('board.model')}).then(function(res) {
        if(res == 'confirm') {
          _this.toggle_mode('edit', {copy_on_save: true});
        }
      });
      return;
    } else if(decision == null && !app_state.get('edit_mode') && this.controller && this.controller.get('board').get('model').get('could_be_in_use')) {
      modal.open('confirm-edit-board', {board: this.controller.get('board.model')}).then(function(res) {
        if(res == 'tweak') {
          _this.controller.send('tweakBoard');
        }
      });
      return;
    }
    this.toggle_mode('edit');
  },
  clear_mode: function() {
    stashes.persist('current_mode', 'default');
    stashes.persist('last_mode', null);
    editManager.clear_paint_mode();
  },
  toggle_mode: function(mode, opts) {
    opts = opts || {};
    utterance.clear({skip_logging: true});
    var current_mode = stashes.get('current_mode');
    var temporary_root_state = null;
    if(opts && opts.force) { current_mode = null; }
    if(mode == 'speak') {
      var board_state = app_state.get('currentBoardState');
      // use the current board's level setting unless forcing the user's home board to be root
      var board_level = board_state && board_state.default_level;
      if(!board_state) {
        // if we're not launching from a currently-viewed board, clear stashed level,
        // which will feel less arbitrary, at least
        stashes.persist('board_level', null);
      }

      var user = app_state.get('referenced_speak_mode_user') || app_state.get('currentUser');
      if(user && current_mode != 'speak') {
        var speak_mode_user = app_state.get('speakModeUser') || app_state.get('currentUser');
        var level = {};
        var state = board_state || opts.override_state;
        // If already on a board, and board level is manually set,
        // check if it's the user's home or sidebar board, and override
        // the user's preferred level
        if(user.get('preferences.home_board.id') == state.id) {
          level.preferred = user.get('preferences.home_board.level');
          level.source = 'home';
        } else {
          (user.get('preferences.sidebar_boards') || []).forEach(function(board) {
            if(board && board.id == state.id) {
              level.preferred = board.level;
              level.source = 'sidebar';
            }
          });
        }
        if(level.preferred || level.source) {
          // If the user has a preference for the currently-launching board,
          // then we take that into account. If already on a board and not in
          // modelling mode, assume this is the user's new preference and
          // update automatically. If not launching from a board, just use the
          // user's preference.
          if(board_state && stashes.get('board_level') && stashes.get('board_level') != level.preferred) {
            level.current = stashes.get('board_level');
            stashes.persist('board_level', level.current); // TODO: isn't this redundant?
            if(opts.override_state) {
              opts.override_state = $.extend({}, opts.override_state, {level: level.current});
            }
            if(user == speak_mode_user) {
              // If in Speak (not modelling) mode, assume the
              // change was intentional and set it to the user's
              // new preference.
              if(level.source == 'home') {
                user.set('preferences.home_board.level', level.current);
                user.save();
              } else {
                (user.get('preferences.sidebar_boards') || []).forEach(function(board) {
                  if(board && board.id == state.id) {
                    emberSet(board, 'level', level.current);
                  }
                });
                user.save();
              }
            }
            board_level = level.current;
          } else if(level.preferred) {
            stashes.persist('board_level', level.preferred);
            if(opts.override_state) {
              opts.override_state = $.extend({}, opts.override_state, {level: level.preferred});
            }
            board_level = level.preferred;
          }
        }
      }

      if(opts && opts.override_state) {
        if(opts.temporary_home && board_state && board_state.id != opts.override_state.id) {
          // If not currently on the override_state board,
          // set the current board as temporary home, and the override_state
          // board as the actual hom
          temporary_root_state = board_state;
        } else {
          // If starting on the user's home board, use that level
          // unless a different one has already been set
          if(opts.temporary_home || stashes.get('board_level')) {
            board_level = null;
          } else {
            board_level = opts.override_state.level || board_level;
          }
        }
        // override_state becomes root_board_state if defined, otherwise use currentBoardState
        board_state = opts.override_state;
      }

      if(board_level) {
        stashes.persist('board_level', board_level);
        console.log("toggling to level", stashes.get('board_level'));
      }
      stashes.persist('root_board_state', board_state);
    }
    if(current_mode == mode) {
      if(mode == 'edit' && stashes.get('last_mode')) {
        stashes.persist('current_mode', stashes.get('last_mode'));
      } else {
        stashes.persist('current_mode', 'default');
      }
      if(mode == 'speak' && app_state.get('currentBoardState')) {
        app_state.set('currentBoardState.reload_token', Math.random());
      }
      stashes.persist('last_mode', null);
      stashes.persist('copy_on_save', null);
    } else {
      if(mode == 'edit') {
        stashes.persist('last_mode', stashes.get('current_mode'));
        if(opts.copy_on_save) {
          stashes.persist('copy_on_save', app_state.get('currentBoardState.id'));
        }
      } else if(mode == 'speak') {
        var already_speaking_as_someone_else = app_state.get('speakModeUser.id') && app_state.get('speakModeUser.id') != app_state.get('sessionUser.id');
        if(app_state.get('currentBoardState')) { delete app_state.get('currentBoardState').reload_token }
        // when entering speak mode, if the user is expired or the 
        // supervisor doesn't have any premium supervisees,
        // pop up a closeable notice about purchasing the app
        if(app_state.get('currentUser') && !opts.reminded && !app_state.get('currentUser.currently_premium') && (!app_state.get('currentUser.supporter_role') || app_state.get('currentUser.limited_supervisor')) && !already_speaking_as_someone_else) {
          return modal.open('premium-required', {user_name: app_state.get('currentUser.user_name'), limited_supervisor: app_state.get('currentUser.limited_supervisor'), remind_to_upgrade: true, action: 'app_speak_mode'}).then(function() {
            opts.reminded = true;
            app_state.toggle_mode(mode, opts);
          });
        }
        if(app_state.get('currentBoardState')) {
          stashes.persist('last_root', {id: app_state.get('currentBoardState.id'), key: app_state.get('currentBoardState.key')});
        }
        // if scanning mode... has to be here because focus will only reliably work when
        // a user-controlled event has occurred, so can't be on a listener
        if(app_state.get('currentUser.preferences.device.scanning') && capabilities.mobile && capabilities.installed_app) { // scanning mode
          scanner.listen_for_input();
        }
      }
      stashes.persist('current_mode', mode);
    }
    stashes.persist('temporary_root_board_state', temporary_root_state);
    stashes.persist('sticky_board', false);
    var $stash_hover = $("#stash_hover");
    $stash_hover.removeClass('on_button').data('button_id', null);
    editManager.clear_paint_mode();
    editManager.clear_preview_levels();
  },
  home_in_speak_mode: function(opts) {
    opts = opts || {};
    var speak_mode_user = opts.user || app_state.get('currentUser');
    // TODO: if preferred matches user's home board, pass the user's level instead of the board's default level
    stashes.persist('board_level', null);
    var preferred = opts.force_board_state || (speak_mode_user && speak_mode_user.get('preferences.home_board')) || opts.fallback_board_state || stashes.get('root_board_state') || {key: 'example/yesno'};
    // TODO: same as above, in .toggle_mode
    if(speak_mode_user && !opts.reminded && speak_mode_user.get('expired')) {
      return modal.open('premium-required', {user_name: speak_mode_user.get('user_name'), remind_to_upgrade: true, action: 'app_speak_mode'}).then(function() {
        opts.reminded = true;
        app_state.home_in_speak_mode(opts);
      });
    }
    if(preferred && speak_mode_user && preferred.id == speak_mode_user.get('preferences.home_board.id')) {
      preferred = speak_mode_user.get('preferences.home_board') || preferred;
    }
    // NOTE: text-direction is updated on board load, so it's ok that it's not known here
    // preferred should include the user's home board setting
    this.toggle_mode('speak', {force: true, override_state: preferred});
    this.set('referenced_board', preferred);
    this.controller.transitionToRoute('board', preferred.key);
  },
  check_scanning: function() {
    var _this = this;
    runLater(function() {
      if(app_state.get('speak_mode') && _this.get('currentUser.preferences.device.scanning')) { // scanning mode
        buttonTracker.scanning_enabled = true;
        buttonTracker.any_select = _this.get('currentUser.preferences.device.scanning_select_on_any_event');
        buttonTracker.select_keycode = _this.get('currentUser.preferences.device.scanning_select_keycode');
        buttonTracker.skip_header = _this.get('currentUser.preferences.device.scanning_skip_header');
        buttonTracker.next_keycode = _this.get('currentUser.preferences.device.scanning_next_keycode');
        buttonTracker.prev_keycode = _this.get('currentUser.preferences.device.scanning_prev_keycode');
        buttonTracker.cancel_keycode = _this.get('currentUser.preferences.device.scanning_cancel_keycode');
        buttonTracker.left_screen_action = _this.get('currentUser.preferences.device.scanning_left_screen_action');
        buttonTracker.right_screen_action = _this.get('currentUser.preferences.device.scanning_right_screen_action');
        if(capabilities.system == 'iOS' && !capabilities.installed_app && !buttonTracker.left_screen_action && !buttonTracker.right_screen_action) {
          modal.warning(i18n.t('keyboard_may_jump', "NOTE: if you don't have a bluetooth switch installed, the keyboard may keep popping up while trying to scan."));
        }
        if(modal.is_open() && (!modal.highlight_settings || modal.highlight_settings.highlight_type != 'button_search')) {
          modal.close();
        }
        var interval = parseInt(_this.get('currentUser.preferences.device.scanning_interval'), 10);
        scanner.start({
          scan_mode: _this.get('currentUser.preferences.device.scanning_mode'),
          interval: interval,
          sweep: _this.get('currentUser.preferences.device.scanning_sweep_speed'),
          auto_scan: interval !== 0,
          auto_start: !_this.get('currentUser.preferences.device.scanning_wait_for_input'),
          vertical_chunks: _this.get('currentUser.preferences.device.scanning_region_rows'),
          debounce: _this.get('currentUser.preferences.debounce'),
          horizontal_chunks: _this.get('currentUser.preferences.device.scanning_region_columns'),
          skip_header: _this.get('currentUser.preferences.device.scanning_skip_header'),
          scanning_auto_select: _this.get('currentUser.preferences.device.scanning_auto_select'),
          audio: _this.get('currentUser.preferences.device.scanning_prompt')
        });
      } else {
        buttonTracker.scanning_enabled = false;
        // this was breaking the "find button" interface when you get to the second board
        if(scanner.interval || (scanner.options || {}).scan_mode == 'axes') {
          scanner.stop();
        }
      }
      buttonTracker.multi_touch_modeling = _this.get('currentUser.preferences.multi_touch_modeling');
      buttonTracker.keyboard_listen = _this.get('currentUser.preferences.device.external_keyboard');
      buttonTracker.dwell_modeling = false;
      buttonTracker.dwell_enabled = false;

      if(app_state.get('speak_mode') && _this.get('currentUser.preferences.device.dwell')) {
        buttonTracker.dwell_enabled = true;
        buttonTracker.dwell_timeout = _this.get('currentUser.preferences.device.dwell_duration');
        buttonTracker.dwell_delay = _this.get('currentUser.preferences.device.dwell_delay');
        buttonTracker.dwell_type = _this.get('currentUser.preferences.device.dwell_type');
        buttonTracker.dwell_selection = _this.get('currentUser.preferences.device.dwell_selection') || 'dwell';
        buttonTracker.select_keycode = _this.get('currentUser.preferences.device.scanning_select_keycode');
        buttonTracker.dwell_arrow_speed = _this.get('currentUser.preferences.device.dwell_arrow_speed');
        buttonTracker.dwell_animation = _this.get('currentUser.preferences.device.dwell_targeting');
        buttonTracker.dwell_release_distance = _this.get('currentUser.preferences.device.dwell_release_distance');
        buttonTracker.dwell_no_cutoff = _this.get('currentUser.preferences.device.dwell_no_cutoff');
        buttonTracker.dwell_cursor = _this.get('currentUser.preferences.device.dwell_cursor');
        buttonTracker.dwell_modeling = _this.get('currentUser.preferences.device.dwell_modeling');
        buttonTracker.dwell_gravity = _this.get('currentUser.preferences.device.dwell_gravity');
        if(buttonTracker.dwell_type == 'eyegaze') {
          capabilities.eye_gaze.listen('noisy');
        }
      } else {
        buttonTracker.dwell_enabled = false;
        capabilities.eye_gaze.stop_listening();
      }
    }, 1000);
  },
  refresh_session_user: function() {
    CoughDrop.store.findRecord('user', 'self').then(function(user) {
      if(!user.get('fresh')) {
        user.reload().then(function(user) {
          app_state.set('sessionUser', user);
        }, function() { });
      }
      app_state.set('sessionUser', user);
    }, function() { });
  },
  set_auto_synced: observer('sessionUser', 'sessionUser.auto_sync', function() {
    var auto_sync = this.get('sessionUser.auto_sync');
    if(auto_sync == null) {
      auto_sync = !!capabilities.installed_app;
    }
    if(window.persistence) {
      window.persistence.set('auto_sync', auto_sync);
    }
  }),
  check_free_space: function() {
    return capabilities.storage.free_space().then(function(res) {
      if(res && res.mb && res.mb < 70) {
        res.too_little = true;
        if(res.gb < 1) { res.gb = null; }
        app_state.set('limited_free_space', res);
      } else {
        app_state.set('limited_free_space', false);
      }
      return res;
    }, function(err) { });
  },
  set_speak_mode_user: function(board_user_id, jump_home, keep_as_self) {
    var session_user_id = this.get('sessionUser.id');
    if(board_user_id == 'self' || (session_user_id && board_user_id == session_user_id)) {
      app_state.set('speakModeUser', null);
      app_state.set('referenced_speak_mode_user', null);
      stashes.persist('speak_mode_user_id', null);
      stashes.persist('referenced_speak_mode_user_id', null);
      if(!app_state.get('speak_mode') && jump_home !== true) {
        this.toggle_speak_mode();
      } else {
        this.home_in_speak_mode();
      }
    } else {
      // TODO: this won't get the device-specific settings correctly unless
      // device_key matches across the users
      var _this = this;

      CoughDrop.store.findRecord('user', board_user_id).then(function(u) {
        var data = RSVP.resolve(u);
        if(!u.get('preferences') || (!u.get('fresh') && stashes.get('online'))) {
          data = u.reload();
        }
        data.then(null, function() {
          // go with what you have, you might not actually be online like you thought you were
          if(u.get('preferences')) {
            return RSVP.resolve(u);
          } else {
            return RSVP.reject();
          }
        }).then(function(u) {
          if(keep_as_self) {
            app_state.set('speakModeUser', null);
            stashes.persist('speak_mode_user_id', null);
          } else {
            app_state.set('speakModeUser', u);
            stashes.persist('speak_mode_user_id', (u && u.get('id')));
          }
          app_state.set('referenced_speak_mode_user', u);
          stashes.persist('referenced_speak_mode_user_id', (u && u.get('id')));
          var user_state = u.get('preferences.home_board');
          var current = app_state.get('currentBoardState') || user_state;
          if(jump_home || (user_state && current && user_state.id == current.id)) {
            _this.home_in_speak_mode({
              user: u,
              reminded: !jump_home,
              fallback_board_state: user_state || app_state.get('sessionUser.preferences.home_board')
            });
          } else {
            if(!app_state.get('speak_mode')) {
              _this.toggle_speak_mode();
            }
            var user_state = u.get('preferences.home_board');
            var current = app_state.get('currentBoardState') || user_state;
            stashes.persist('temporary_root_board_state', current);
          }
        }, function() {
          modal.error(i18n.t('user_retrive_failed', "Failed to retrieve user details for Speak Mode"));
        });
      }, function() {
        modal.error(i18n.t('user_retrive_failed', "Failed to retrieve user for Speak Mode"));
      });
    }
  },
  say_louder: function(pct) {
    this.controller.sayLouder(pct);
  },
  flip_text: function() {
    this.set('flipped', !this.get('flipped'));
  },
  save_phrase: function(voc, category) {
    var user = app_state.get('currentUser');
    if(user) {
      // TODO: needs to peresist locally if offline
      var vocs = user.get('vocalizations') || []
      var id = Math.round(Math.random() * 9999).toString() + ((new Date()).getTime() % 1000).toString() + vocs.length;
      user.add_action({
        action: 'add_vocalization',
        value: voc,
        category: category || 'default',
        ts: Math.round((new Date()).getTime() / 1000),
        id: id
      });
      vocs.unshift({list: voc, category: category, id: id, ts: Math.round((new Date()).getTime() / 1000)});
      user.set('vocalizations', vocs);
      user.save().then(function() { user.set('offline_actions', null); }, function() { });
    } else {
      stashes.remember({override: voc});
    }
  },
  remove_phrase: function(phrase) {
    var voc = app_state.get('currentUser.vocalizations') || [];
    var stash = stashes.get('remembered_vocalizations');
    var matches = 0;
    if(phrase.id) {
      voc = voc.filter(function(v) { 
        if(v.id == phrase.id) { matches++; return matches > 1; }
        return true;
      });
    } else {
      voc = voc.filter(function(v) { 
        if(v.sentence == phrase.sentence && !phrase.stash) { matches++; return matches > 1; }
        return true;
      });
      stash = stash.filter(function(v) {
        if(v.sentence == phrase.sentence && phrase.stash) { matches++; return matches > 1; }
        return true;
      });
    }
    if(app_state.get('currentUser')) {
      var u = app_state.get('currentUser');
      u.set('vocalizations', voc);
      u.add_action({
        action: 'remove_vocalization',
        value: phrase.id
      });
      u.save().then(function() { u.set('offline_actions', null); }, function() { });
    }
    stashes.persist('remembered_vocalizations', stash);
  },
  shift_phrase: function(phrase, direction) {
    if(app_state.get('currentUser')) {
      var u = app_state.get('currentUser');
      var list = u.get('vocalizations') || [];
      var voc = list.find(function(v) { return v && v.id && phrase.id && v.id == phrase.id; });
      var idx = list.indexOf(voc);
      if(idx !== -1) {
        if(direction == 'up' && idx > 0) {
          var pre = list.filter(function(v, jdx) { return (v.category || 'default') == (phrase.category || 'default') && jdx < idx; }).pop();
          var pre_idx = list.indexOf(pre);
          if(pre && pre_idx !== -1) {
            var ref = list[pre_idx];
            list[pre_idx] = voc;
            list[idx] = ref;
          }
        } else if(direction == 'down' && idx < list.length - 1) {
          var post = list.find(function(v, jdx) { return (v.category || 'default') == (phrase.category || 'default') && jdx > idx; });
          var post_idx = list.indexOf(post);
          if(post && post_idx !== -1) {
            var ref = list[post_idx];
            list[post_idx] = voc;
            list[idx] = ref;
          }
        }
      }
      var ids = list.map(function(v) { return v && v.id; }).join(',');
      u.set('vocalizations', list);
      u.add_action({
        action: 'reorder_vocalizations',
        value: ids
      })
      u.save().then(function() { u.set('offline_actions', null); }, function() { });
    }
  },
  set_and_say_buttons(vocalizations) {
    this.controller.set_and_say_buttons(vocalizations);
  },
  set_current_user: observer('sessionUser', 'speak_mode', 'speakModeUser', function() {
    this.did_set_current_user = true;
    if(app_state.get('speak_mode') && app_state.get('speakModeUser')) {
      app_state.set('currentUser', app_state.get('speakModeUser'));
    } else {
      var user = app_state.get('sessionUser');
      if(user && user.get && !user.get('preferences.progress.app_added') && (navigator.standalone || (capabilities.installed_app && capabilities.mobile))) {
        user.set('preferences.progress.app_added', true);
        user.save().then(null, function() { });
      }
      app_state.set('currentUser', user);
    }
    if(app_state.get('currentUser')) {
      app_state.set('currentUser.load_all_connections', true);
    }
  }),
  eye_gaze_state: computed(
    'currentUser.preferences.device.dwell',
    'currentUser.preferences.device.dwell_type',
    'eye_gaze.statuses',
    function() {
      if(!this.get('currentUser.preferences.device.dwell') || this.get('currentUser.preferences.device.dwell_type') != 'eyegaze') {
        return null;
      }
      var state = {};
      var statuses = emberGet(capabilities.eye_gaze, 'statuses') || {};
      var active = null, pending = null, dormant = null;
      for(var idx in statuses) {
        if(statuses[idx]) {
          if(statuses[idx].active) {
            if(!statuses[idx].dormant) {
              if(!active || active.dormant) {
                active = statuses[idx];
              }
            } else {
              dormant = dormant || statuses[idx];
            }
          } else if(!statuses[idx].disabled) {
            pending = pending || statuses[idx];
          }
        }
      }

      if(!active && !pending && !dormant) {
        return null;
      }
      return {
        active: !!active,
        dormant: !!(!active && dormant),
        disabled: !!(!active && !dormant),
        status: (active && active.status) || (dormant && dormant.status) || (pending && pending.status)
      };
    }
  ),
  dom_changes_on_board_state_change: observer('currentBoardState', function() {
    if(!this.get('currentBoardState')) {
      $('#speak_mode').popover('destroy');
      $('html,body').css('overflow', '');
    } else if(!app_state.get('testing')) {
      $('html,body').css('overflow', 'hidden').scrollTop(0);
      try {
        this.controller.set('footer', false);
      } catch(e) { }
    }
  }),
  update_button_tracker: observer(
    'speak_mode',
    'currentUser.preferences.activation_location',
    'currentUser.preferences.activation_minimum',
    'currentUser.preferences.activation_cutoff',
    'currentUser.preferences.activation_on_start',
    'currentUser.preferences.debounce',
    function() {
      if(app_state.get('speak_mode')) {
        buttonTracker.minimum_press = this.get('currentUser.preferences.activation_minimum');
        buttonTracker.activation_location = this.get('currentUser.preferences.activation_location');
        buttonTracker.clear_on_wiggle = true; // TODO: make this a user pref
        buttonTracker.short_press_delay = this.get('currentUser.preferences.activation_cutoff');
        if(this.get('currentUser.preferences.activation_on_start')) {
          buttonTracker.short_press_delay = 50;
        }
        buttonTracker.swipe_pages = !!this.get('currentUser.preferences.swipe_pages');
        buttonTracker.long_press_delay = Math.max((buttonTracker.short_press_delay || 50) * 2, 1500);
        buttonTracker.debounce = this.get('currentUser.preferences.debounce');
      } else if (window.user_preferences) {
        buttonTracker.minimum_press = null;
        buttonTracker.activation_location = null;
        buttonTracker.long_press_delay = 1500;
        buttonTracker.short_press_delay = null;
        buttonTracker.debounce = null;
      }
    }
  ),
  align_button_list: observer(
    'speak_mode',
    'button_list',
    'button_list.length',
    'insertion.index',
    function() {
      if(app_state.get('speak_mode')) {
        runLater(function() {
          var $button_list = $("#button_list");
          var $item = null;
          if(app_state.get('insertion.index')) {
            $item = $button_list.find(".utterance_cursor");
            if($item.length == 0) {
              $item = $button_list.find(".history_button:not(.utterance_cursor)").eq(app_state.get('insertion.index'));
            }
          }
          if(!$item || $item.length == 0) { $item = $button_list.find(".history_button").last(); }
          if($item.length && $button_list.length) {
            var box_bounds = $button_list[0].getBoundingClientRect();
            var scroll_top = $button_list.scrollTop();
            var item_bounds = $item[0].getBoundingClientRect();
            // TODO: don't know why the 1 is necessary
            var top = item_bounds.top + scroll_top - box_bounds.top - 1; 
            $button_list.scrollTop(top);
          } else {
            $button_list.scrollTop(9999999);
          }
        }, 200);
      }
    }
  ),
  monitor_scanning: observer('speak_mode', 'currentBoardState', function() {
    this.check_scanning();
  }),
  get_history: function() {
    if(app_state.get('speak_mode')) {
      return stashes.get('boardHistory');
    } else {
      return stashes.get('browse_history');
    }
  },
  set_history: function(hist) {
    if(app_state.get('speak_mode')) {
      stashes.persist('boardHistory', hist);
    } else {
      stashes.persist('browse_history', hist);
    }
  },
  feature_flags: computed('currentUser.feature_flags', function() {
    var res = this.get('currentUser.feature_flags') || {};
    (window.enabled_frontend_features || []).forEach(function(feature) {
      emberSet(res, feature, true);
    });
    return res;
  }),
  empty_header: computed('default_mode', 'currentBoardState', 'hide_search', function() {
    return !!(this.get('default_mode') && !this.get('currentBoardState') && !this.get('hide_search'));
  }),
  header_size: computed(
    'currentUser.preferences.device.vocalization_height',
    'window_inner_width',
    'flipped',
    'currentUser.preferences.device.flipped_override',
    function() {
      var size = this.get('currentUser.preferences.device.vocalization_height') || ((window.user_preferences || {}).device || {}).vocalization_height || 100;
      if(this.get('currentUser.preferences.device.flipped_override') && this.get('flipped') && this.get('currentUser.preferences.device.flipped_height')) {
        size = this.get('currentUser.preferences.device.flipped_height');
      }
      if(window.innerHeight < 400) {
        size = 'tiny';
      } else if(window.innerHeight < 600 && size != 'tiny') {
        size = 'small';
      }
      return size;
    }
  ),
  header_height: computed('header_size', 'speak_mode', function() {
    if(this.get('speak_mode')) {
      var size = this.get('header_size');
      if(size == 'tiny') {
        return 50;
      } else if(size == 'small') {
        return 70;
      } else if(size == 'medium') {
        return 100;
      } else if(size == 'large') {
        return 150;
      } else if(size == 'huge') {
        return 200;
      }
    } else {
      return 70;
    }
  }),
  check_for_currently_premium: function(user, action, allow_fully_purchased) {
    var allowed = user && user.get('currently_premium');
    if(allow_fully_purchased && user && user.get('fully_purchased')) {
      allowed = true;
    }
    if(allowed) {
      return RSVP.resolve({dialog: false});
    } else {
      return modal.open('premium-required', {user_name: user.get('user_name'), action: action}).then(function() {
        return RSVP.reject({dialog: true});
      });
    }
  },
  check_for_edit_mode_needing_purchase: function(user) {
    // If the user is very expired, or they are a supervisor with no
    // supervisees, remind them when they to go edit that they really
    // should purchase or connect with a purchased account, but don't
    // prevent them from editing, just remind them regularly?
    if(user && (user.get('really_expired') || user.get('limited_supervisor'))) {
      return modal.open('premium-required', {user_name: user.get('user_name'), cancel_on_close: false, remind_to_upgrade: true}).then(function() {
        return RSVP.resolve({dialog: true});
      });
    } else {
      return RSVP.resolve({dialog: false});
    }
  },
  on_user_change: observer('currentUser', function() {
    if(this.get('currentUser') && CoughDrop.Board) {
      CoughDrop.Board.clear_fast_html();
    }
  }),
  speak_mode_handlers: observer(
    'speak_mode',
    'currentUser.id',
    'currentUser.preferences.logging',
    'referenced_user.id',
    function() {
      if(session.get('isAuthenticated') && !app_state.get('currentUser.id')) {
        // Don't run handlers on page reload until user is loaded
        return;
      }
      if(this.get('speak_mode')) {
        stashes.set('logging_enabled', !!(this.get('speak_mode') && this.get('currentUser.preferences.logging')));
        stashes.set('geo_logging_enabled', !!(this.get('speak_mode') && this.get('currentUser.preferences.geo_logging')));
        stashes.set('speaking_user_id', this.get('currentUser.id'));
        stashes.set('session_user_id', this.get('sessionUser.id'));

        var geo_enabled = app_state.get('currentUser.preferences.geo_logging') || app_state.get('sidebar_boards').find(function(b) { return b.highlight_type == 'locations' || b.highlight_type == 'custom'; });
        if(geo_enabled) {
          stashes.geo.poll();
        }
        this.set('speak_mode_started', (new Date()).getTime());

        // this method is getting called again on every board load, even if already in speak mode. This check
        // limits the following block to once per speak-mode-activation.
        if(!this.get('last_speak_mode')) {
          if(this.get('currentUser.preferences.speak_on_speak_mode')) {
            runLater(function() {
              speecher.speak_text(i18n.t('here_we_go', "here we go"), null, {volume: 0.1});
            }, 200);
          }
          this.set('speak_mode_activities_at', (new Date()).getTime());
          this.set('speak_mode_modeling_ideas', null);
          if(this.get('currentUser.preferences.device.wakelock') !== false) {
            capabilities.wakelock('speak!', true);
          }
          // When entering Speak Mode, use the board's default locale
          if(this.get('currentBoardState.default_locale')) {
            var loc = this.get('currentBoardState.default_locale');
            app_state.set('label_locale', loc);
            app_state.set('vocalization_locale', loc);
          }
          this.set_history([]);
          var noticed = false;
          if(stashes.get('logging_enabled')) {
            noticed = true;
            modal.notice(i18n.t('logging_enabled', "Logging is enabled"), true);
          }
          if(this.get('currentBoardState.has_fallbacks')) {
            modal.notice(i18n.t('board_using_fallbacks', "This board uses premium assets which you don't have access to so you will see free images and sounds which may not perfectly match the author's intent"), true);
          }
          if(!capabilities.mobile && this.get('currentUser.preferences.device.fullscreen')) {
            capabilities.fullscreen(true).then(null, function() {
              if(!noticed) {
                modal.warning(i18n.t('fullscreen_failed', "Full Screen Mode failed to load"), true);
              }
            });
          }
          $("#hidden_input").val("");
          capabilities.tts.reload().then(function(res) {
            console.log("tts reload status");
            console.log(res);
          });
          capabilities.volume_check().then(function(level) {
            console.log("volume is " + level);
            if(level === 0) {
              noticed = true;
              modal.warning(i18n.t('volume_is_off', "Volume is muted, you will not be able to hear speech"), true);
            } else if(level < 0.2) {
              noticed = true;
              modal.warning(i18n.t('volume_is_low', "Volume is low, you may not be able to hear speech"), true);
            }
          });
          capabilities.silent_mode().then(function(silent) {
            if(silent && capabilities.system == 'iOS') {
              modal.warning(i18n.t('ios_muted', "The app is currently muted, so you will not hear speech. To unmute, check the mute switch, and also swipe up from the bottom of the screen to check for app-level muting"), true);
            }
          });
          var ref_user = this.get('referenced_speak_mode_user') || this.get('currentUser');
          if(ref_user && ref_user.get('goal.summary')) {
            runLater(function() {
              noticed = true;
              var str = i18n.t('user_apostrophe', "%{user_name}'s ", {user_name: ref_user.get('user_name')});
              str = str + i18n.t('current_goal', "Current Goal: %{summary}", {summary: ref_user.get('goal.summary')});
              modal.notice(str, true);
            }, 100);
          }
          speecher.set_output_target({}, function() { });
          app_state.load_user_badge();
          if(app_state.get('installed_app') && window.persistence) {
            var get_local_revisions = window.persistence.find('settings', 'synced_full_set_revisions').then(function(res) {
              if(app_state.get('currentBoardState.id') && !res[app_state.get('currentBoardState.id')]) {
                if(!window.persistence.get('last_sync_at')) {
                  // if not ever synced, remind them to sync before trying to use Speak Mode
                  modal.warning(i18n.t('remember_to_sync', "Remember to sync before trying to use boards somewhere without a strong Internet connection!"), true);
                } else if(app_state.get('current_board_in_extended_board_set')) {
                  // if synced and this is in home board set, remind them to sync
                  modal.warning(i18n.t('need_to_re_sync', "Remember to sync so you have access to all your boards offline!"), true);
                } else {
                  // otherwise, remind them about unsynced boards
                  modal.warning(i18n.t('unsynced_boards_may_not_work', "This board isn't available from you home board or sidebar so it won't be synced, and may not work properly without a strong Internet connection"), true);
                }
              }
            }, function() { });
          }
        }
        this.set('eye_gaze', capabilities.eye_gaze);
        this.set('embedded', !!(CoughDrop.embedded));
        this.set('full_screen_capable', capabilities.fullscreen_capable());
        if(this.get('currentBoardState') && this.get('currentUser.needs_speak_mode_intro')) {
          var intro = this.get('currentUser.preferences.progress.speak_mode_intro_done');
          if(!intro && !app_state.get('speak-mode-intro')) {
            if(modal.route && !modal.is_open('speak-mode-intro')) {
              modal.open('speak-mode-intro');
            }
          } else if(intro && !this.get('currentUser.preferences.progress.modeling_intro_done') && this.get('currentUser.preferences.logging') && !app_state.get('modeling-intro')) {
            var now = (new Date()).getTime();
            if(intro === true && this.get('currentUser.joined')) { intro = this.get('currentUser.joined').getTime(); }
            if(now - intro > (4 * 24 * 60 * 60 * 1000)) {
              if(modal.route && !modal.is_open('modeling-intro')) {
                modal.open('modeling-intro');
              }
            }
          }
        }
      } else if(!this.get('speak_mode') && this.get('last_speak_mode') !== undefined) {
        capabilities.wakelock('speak!', false);
        capabilities.fullscreen(false);
        buttonTracker.hit_spots = [];
        if(this.get('last_speak_mode') !== false) {
          stashes.persist('temporary_root_board_state', null);
          stashes.persist('sticky_board', false);
          stashes.persist('speak_mode_user_id', null);
          stashes.persist('all_buttons_enabled', null);
          app_state.set('label_locale', null);
          stashes.persist('label_locale', null);
          app_state.set('vocalization_locale', null);
          stashes.persist('vocalization_locale', null);
          app_state.set('manual_modeling', false);
          app_state.set('referenced_speak_mode_user', null);
          stashes.persist('referenced_speak_mode_user_id', null);
          if(CoughDrop.Board) {
            CoughDrop.Board.clear_fast_html();
          }
        }
      }
      if(!session.get('isAuthenticated') || app_state.get('currentUser')) {
        this.set('last_speak_mode', !!this.get('speak_mode'));
      }
    }
  ),
  update_speak_mode_modeling_ideas: observer(
    'speak_mode',
    'referenced_user.id',
    'speak_mode_activities_at',
    'short_refresh_stamp',
    function() {
      var _this = this;
      var cutoff = (new Date()).getTime() - (45 * 1000);
      // Try showing modeling ideas as an icon for like thirty seconds when
      // first entering speak mode, if there are any. (if the user has already checked out
      // modeling ideas at least once)
      if(_this.get('speak_mode_activities_at') < cutoff) {
        if(_this.get('speak_mode_modeling_ideas')) {
          _this.set('speak_mode_modeling_ideas.enabled', false);
          _this.set('speak_mode_modeling_ideas.timeout', true);
        }
        return;
      }
      if(!_this.get('speak_mode') || _this.get('referenced_user.id') === _this.get('speak_mode_modeling_ideas.user_id')) {
        return;
      }
      if(_this.get('currentUser.preferences.progress.modeling_ideas_viewed')) {
        if(_this.get('referenced_user.currently_premium') && !_this.get('referenced_user.supporter_role')) {
          _this.set('speak_mode_modeling_ideas', {user_id: _this.get('referenced_user.id')});      
          _this.get('referenced_user').load_word_activities().then(function(activities) {
            if(activities && activities.list && activities.list.length > 0) {
              var list = activities.words;
              // If user-defined goal words are set, use one of those if possible
              var goal_list = (activities.words || []).filter(function(w) {
                return w && w.reasons && w.reasons.indexOf('primary_words') !== -1;
              });
              if(goal_list.length > 0) { list = goal_list; }
              var mod = (new Date()).getDate() % (list || {length: 3}).length;
              var word = ((list || [])[mod] || {}).word;
              _this.set('speak_mode_modeling_ideas', {user_id: _this.get('referenced_user.id'), enabled: true, word: word});
            }
          }, function() { });
        } else {
          _this.set('speak_mode_modeling_ideas', false);
        }
      } else {
        _this.set('speak_mode_modeling_ideas', false);      
      }
    }
  ),
  handle_tag: function(tag) {
    if(!app_state.get('speak_mode')) { return; }
    var text_fallback = function(text) {
      if(!text) { return; }
      var obj = {
        label: text,
        vocalization: text,
        prevent_return: true,
        button_id: null,
        board: {id: app_state.get('currentBoardState.id'), parent_id: app_state.get('currentBoardState.parent_id'), key: app_state.get('currentBoardState.key')},
        type: 'speak'
      };
  
      app_state.activate_button({}, obj);
    };
    if(tag.uri) {
      var tag_id = (tag.uri.match(/^cough:\/\/tag\/([^\/]+)$/) || [])[1];
      tag_id = tag_id || JSON.stringify(tag.id);
      if(tag_id) {
        // check local or remote for matching tag
        CoughDrop.store.findRecord('tag', tag_id).then(function(tag_object) {
          if(tag_object.get('button')) {
            var button = Button.create(tag_object.get('button'));
            app_state.controller.activateButton(button, {board: editManager.controller.get('model')});
          } else {
            text_fallback(tag_object.get('label'));
          }
        }, function(err) { 
          // if no tag round, fall back to text
          text_fallback(tag.text); 
        });
      } else {
        text_fallback(tag.text);
      }
    } else if(tag && tag.text && tag.text.match(/^\"/) && tag.text.match(/\"$/)) {
      // speak the tag's text
      text_fallback(tag.text.slice(1, tag.text.length - 2));
    }
  },
  speak_mode: computed('stashes.current_mode', 'currentBoardState', function() {
    return !!(stashes.get('current_mode') == 'speak' && this.get('currentBoardState'));
  }),
  edit_mode: computed('stashes.current_mode', 'currentBoardState', function() {
    return !!(stashes.get('current_mode') == 'edit' && this.get('currentBoardState'));
  }),
  default_mode: computed('stashes.current_mode', 'currentBoardState', function() {
    return !!(stashes.get('current_mode') == 'default' || !this.get('currentBoardState'));
  }),
  limited_speak_mode_options: computed(
    'speak_mode',
    'currentUser.preferences.require_speak_mode_pin',
    function() {
      return this.get('speak_mode');
      // TODO: decide if this should be an option at all
      //return this.get('speak_mode') && this.get('currentUser.preferences.require_speak_mode_pin');
    }
  ),
  superProtectedSpeakMode: computed('speak_mode', 'embedded', function() {
    return this.get('speak_mode') && this.get('embedded');
  }),
  auto_exit_speak_mode: observer('speak_mode_started', 'medium_refresh_stamp', function() {
    var now = (new Date()).getTime();
    var redirect_option = false;
    // if we're speaking as the current user and they're a limited supervisor, or if
    // we're speaking/modeling related to a supervisee and they're expired, limit
    // the session to 15 minutes and notify them of the time limit.
    if(this.get('speak_mode') && this.get('speak_mode_started')) {
      var started = this.get('speak_mode_started');
      var done = false;
      // If running speak mode for themselves, supervisors need to be paid or working with someone
      if(this.get('currentUser.id') == this.get('sessionUser.id') && !this.get('referenced_speak_mode_user') && this.get('currentUser.limited_supervisor')) {
        if(started < now - (15 * 60 * 1000)) {
          redirect_option = 'contact';
          done = i18n.t('limited_supervisor_timeout', "Speak mode sessions are limited to 15 minutes for supervisors not working with paid communicators. Please contact us if you need a full-featured evaluation account.");
        }
      // If running speak mode for a communicator, check the status of the communicator
      } else if(this.get('sessionUser.id') != this.get('referenced_speak_mode_user.id') && this.get('referenced_speak_mode_user.expired')) {
        if(started < now - (15 * 60 * 1000)) {
          redirect_option = 'contact';
          done = i18n.t('expired_supervisee_timeout', "Speak mode sessions are limited to 15 minutes when working with communicators that don't have a paid or sponsored account.");
        }
      // If running speak mode as a communicator, check if they're expired
      } else if(this.get('currentUser.expired')) {
        if(started < now - (15 * 60 * 1000)) {
          redirect_option = 'subscribe';
          done = i18n.t('really_expired_communicator_timeout', "This account has expired, and sessions are limited to 15 minutes. If you need help with funding we can help, please contact us!");
        }
      }

      if(done) {
        this.toggle_speak_mode();
        modal.notice(done, true, true, {redirect: redirect_option});
        this.set('speak_mode_started', null);
      }
    } else {
      this.set('speak_mode_started', null);
    }
  }),
  check_inbox: observer('referenced_user.id', 'medium_refresh_stamp', function() {
    var ref_user = app_state.get('referenced_user');
    if(window.persistence && window.persistence.get('online') && app_state.get('speak_mode') && ref_user) {
      var last_share = ref_user.get('last_share') || 0;
      var last_check = ref_user.get('retrieved') || ref_user.get('last_sync_stamp.checked') || 1;
      var now = (new Date()).getTime();

      // but default check for new messages once every 10 minutes
      var cutoff = now - (10 * 60 * 1000);
      if(ref_user.get('last_sync_stamp.user_id') != ref_user.get('id')) {
        // after switching communicators, make sure you have the latest
        cutoff = now - (5 * 60 * 1000);
      }
      if(now - last_share < (15 * 60 * 1000)) {
        // after a messaging share, check more frequently for the next 15 minutes
        cutoff = now - (60 * 1000);
      } else if(now - last_share < (60 * 60 * 1000)) {
        // for a while after, check a little more frequently
        cutoff = now - (3 * 60 * 1000);
      }
      if(last_check < (cutoff + 5000)) {
        ref_user.set('last_sync_stamp', {user_id: ref_user.get('id'), checked: (new Date()).getTime()});
        ref_user.reload().then(function(res) {
        }, function() { });
      }
    }
  }),
  current_board_name: computed('currentBoardState', function() {
    var state = this.get('currentBoardState');
    if(state && state.key) {
      return state.name || state.key.split(/\//)[1];
    }
    return null;
  }),
  current_board_user_name: computed('currentBoardState', function() {
    var state = this.get('currentBoardState');
    if(state && state.key) {
      return state.key.split(/\//)[0];
    }
    return null;
  }),
  current_board_is_home: computed(
    'currentBoardState',
    'currentUser',
    'currentUser.preferences.home_board.id',
    function() {
      var board = this.get('currentBoardState');
      var user = this.get('currentUser');
      return !!(board && user && user.get('preferences.home_board.id') == board.id);
    }
  ),
  current_board_is_speak_mode_home: computed(
    'speak_mode',
    'currentBoardState',
    'stashes.root_board_state',
    'stashes.temporary_root_board_state',
    function() {
      var state = stashes.get('temporary_root_board_state') || stashes.get('root_board_state');
      var current = this.get('currentBoardState');
      return this.get('speak_mode') && state && current && state.key == current.key;
    }
  ),
  root_board_is_home: computed(
    'stashes.root_board_state',
    'stashes.temporary_root_board_state',
    'currentUser.preferences.home_board.id',
    function() {
      var state = stashes.get('temporary_root_board_state') || stashes.get('root_board_state');
      var user = this.get('currentUser');
      return !!(state && user && user.get('preferences.home_board.id') == state.id);
    }
  ),
  current_board_not_home_or_supervising: computed('current_board_is_home', 'currentUser.supervisees', function() {
    return !this.get('current_board_is_home') || (this.get('currentUser.supervisees') || []).length > 0;
  }),
  current_board_in_board_set: computed('currentUser.stats.board_set_ids', 'currentBoardState', function() {
    return (this.get('currentUser.stats.board_set_ids') || []).indexOf(this.get('currentBoardState.id')) >= 0;
  }),
  current_board_in_extended_board_set: computed(
    'currentUser.stats.board_set_ids_including_supervisees',
    'currentBoardState',
    function() {
      return (this.get('currentUser.stats.board_set_ids_including_supervisees') || []).indexOf(this.get('currentBoardState.id')) >= 0;
    }
  ),
  speak_mode_possible: computed(
    'currentBoardState',
    'currentUser',
    'currentUser.preferences.home_board.key',
    function() {
      return !!(this.get('currentBoardState') || this.get('currentUser.preferences.home_board.key'));
    }
  ),
  board_in_current_user_set: computed('currentUser.stats.board_set_ids', 'currentBoardState.id', function() {
    return (this.get('currentUser.stats.board_set_ids') || []).indexOf(this.get('currentBoardState.id')) >= 0;
  }),
  empty_board_history: computed(
    'stashes.boardHistory',
    'stashes.browse_history',
    'speak_mode',
    function() {
      // TODO: this is borken
      return this.get_history().length === 0;
    }
  ),
  sidebar_visible: computed(
    'speak_mode',
    'stashes.sidebarEnabled',
    'currentUser',
    'currentUser.preferences.quick_sidebar',
    function() {
      // TODO: does this need to trigger board resize event? maybe...
      return this.get('speak_mode') && (stashes.get('sidebarEnabled') || this.get('currentUser.preferences.quick_sidebar'));
    }
  ),
  sidebar_relegated: computed('speak_mode', 'window_inner_width', function() {
    return this.get('speak_mode') && this.get('window_inner_width') < 750;
  }),
  time_string: function(timestamp) {
    return window.moment(timestamp).format("HH:mm");
  },
  fenced_sidebar_board: computed(
    'last_fenced_board',
    'medium_refresh_stamp',
    'current_ssid',
    'stashes.geo.latest',
    'nearby_places',
    'currentUser',
    'current_sidebar_boards',
    function() {
      var _this = this;
      var loose_tolerance = 1000; // 1000 ft
      var boards = this.get('current_sidebar_boards') || [];
      var all_matches = [];
      var now_time_string = _this.time_string((new Date()).getTime());
      var any_places = false;
      boards.forEach(function(b) { if(b.places) { any_places = true; } });
      var current_place_types = {};
      if(_this.get('nearby_places') && any_places) {
        // set current_place_types to the list of places for the closest-retrieved place
        (_this.get('nearby_places') || []).forEach(function(place) {
          var d = geolocation.distance(place.latitude, place.longitude, stashes.get('geo.latest.coords.latitude'), stashes.get('geo.latest.coords.longitude'));
          // anything with 500ft could be a winner
          if(d && d < 500) {
            place.types.forEach(function(type) {
              if(!current_place_types[type] || current_place_types[type].distance > d) {
                current_place_types[type] = {
                  distance: d,
                  latitude: place.latitude,
                  longitude: place.longitude
                };
              }
            });
          }
        });
      }
      boards.forEach(function(brd) {
        var do_add = false;
        // add all sidebar boards that match any of the criteria
        var ssids = brd.ssids || [];
        if(ssids.split) { ssids = ssids.split(/,/); }
        var matches = {};
        if(ssids && ssids.indexOf(_this.get('current_ssid')) != -1) {
          matches['ssid'] = true;
        }
        var geo_set = false;
        if(brd.geos && stashes.get('geo.latest.coords')) {
          var geos = brd.geos || [];
          if(geos.split) { geos = geos.split(/;/).map(function(g) { return g.split(/,/).map(function(n) { return parseFloat(n); }); }); }
          brd.geo_distance = -1;
          geos.forEach(function(geo) {
            var d = geolocation.distance(stashes.get('geo.latest.coords.latitude'), stashes.get('geo.latest.coords.longitude'), geo[0], geo[1]);
            if(d && d < loose_tolerance && (brd.geo_distance == -1 || d < brd.geo_distance)) {
              brd.geo_distance = d;
              geo_set = true;
              matches['geo'] = true;
            }
          });
        }
        if(brd.times) {
          var all_times = brd.times || [];

          all_times.forEach(function(times) {
            if(times[0] > times[1]) {
              if(now_time_string >= times[0] || now_time_string <= times[1]) {
                matches['time'] = true;
              }
            } else {
              if(now_time_string >= times[0] && now_time_string <= times[1]) {
                matches['time'] = true;
              }
            }
          });
        }
        if(brd.places && Object.keys(current_place_types).length > 0) {
          var places = brd.places || [];
          if(places.split) { places = places.split(/,/); }
          var closest = null;
          places.forEach(function(place) {
            if(current_place_types[place]) {
              if(!closest || current_place_types[place].distance < closest) {
                closest = current_place_types[place].distance;
                matches['place'] = true;
                if(!geo_set) {
                  brd.geo_distance = closest;
                }
              }
            }
          });
        }

        if(brd.highlight_type == 'locations' && (matches['geo'] || matches['ssid'])) {
          all_matches.push(brd);
        } else if(brd.highlight_type == 'places' && matches['place']) {
          all_matches.push(brd);
        } else if(brd.highlight_type == 'times' && matches['time']) {
          all_matches.push(brd);
        } else if(brd.highlight_type == 'custom') {
          if(!brd.ssids || matches['ssid']) {
            if(!brd.geos || matches['geo']) {
              if(!brd.places || matches['place']) {
                if(!brd.times || matches['time']) {
                  all_matches.push(brd);
                }
              }
            }
          }
        }
      });
      var res = all_matches[0];
      if(all_matches.length > 1) {
        if(!all_matches.find(function(m) { return !m.geo_distance; })) {
          // if it's location-based just return the closest one
          res = all_matches.sort(function(a, b) { return a.geo_distance - b.geo_distance; })[0];
        } else {
          // otherwise craft a special button that pops up the list of matches
        }
      }
      if(res) {
        res = $.extend({}, res);
        res.fenced = true;
        res.shown_at = (new Date()).getTime();
        _this.set('last_fenced_board', res);
      } else if(_this.get('last_fenced_board') && _this.get('last_fenced_board').shown_at && _this.get('last_fenced_board').shown_at > (new Date()).getTime() - (2*60*1000)) {
        // if there is no fenced board but there was one, go ahead and keep that one around
        // for an extra minute or so
        res = _this.get('last_fenced_board');
      }
      return res;
    }
  ),
  current_sidebar_boards: computed('referenced_user.sidebar_boards_with_fallback', function() {
    var res = this.get('referenced_user.sidebar_boards_with_fallbacks');
    return res;
  }),
  check_locations: observer(
    'speak_mode',
    'persistence.online',
    'stashes.geo.latest',
    'modeling_for_user',
    'currentUser',
    'currentUser.sidebar_boards_with_fallbacks',
    'referenced_speak_mode_user',
    'referenced_speak_mode_user.sidebar_boards_with_fallback',
    function() {
      if(!this.get('speak_mode')) { return RSVP.resolve([]); }
      var boards = this.get('current_sidebar_boards') || [];
      if(!boards.find(function(b) { return b.places; })) { return RSVP.reject(); }
      var res = geolocation.check_locations();
      res.then(null, function() { });
      return res;
    }
  ),
  sidebar_boards: computed(
    'fenced_sidebar_board',
    'currentUser',
    'current_sidebar_boards',
    function() {
      var res = this.get('current_sidebar_boards');
      if(!res && window.user_preferences && window.user_preferences.any_user && window.user_preferences.any_user.default_sidebar_boards) {
        res = window.user_preferences.any_user.default_sidebar_boards;
      }
      res = res || [];
      var sb = this.get('fenced_sidebar_board');
      if(!sb) { return res; }
      res = res.filter(function(b) { return b.key != sb.key; });
      res.unshift(sb);
      return res;
    }
  ),
  sidebar_pinned: computed(
    'speak_mode',
    'currentUser',
    'currentUser.preferences.quick_sidebar',
    function() {
      return this.get('speak_mode') && this.get('currentUser.preferences.quick_sidebar');
    }
  ),
  referenced_user: computed(
    'modeling_for_user',
    'currentUser',
    'referenced_speak_mode_user',
    function() {
      var user = app_state.get('currentUser');
      if(this.get('modeling_for_user') && this.get('referenced_speak_mode_user')) {
        user = this.get('referenced_speak_mode_user');
      }
      return user;
    }
  ),
  ding_on_message: observer('referenced_user.unread_alerts', function() {
    var ref_id = this.get('referenced_user.id') + ":" + this.get('referenced_user.unread_alerts');
    if(ref_id != this.get('last_ding_state') && this.get('speak_mode') && this.get('referenced_user.unread_alerts') > 0) {
      speecher.click('ding');
    }
    this.set('last_ding_state', ref_id);
  }),
  load_user_badge: observer('speak_mode', 'referenced_user', 'persistence.online', function() {
    if(this.get('speak_mode') && this.get('persistence.online')) {
      var badge_hash = (this.get('referenced_user.id') || 'nobody') + "::" + ((new Date()).getTime() / 1000 / 3600)
      // don't check more than once an hour
      if(this.get('user_badge_hash') == badge_hash) { return; }
      var old_badge_hash = this.get('user_badge_hash');

      var _this = this;
      var user = this.get('referenced_user');
      // clear current badge if it doesn't match the referenced user info
      if(!user || _this.get('user_badge.user_id') != user.get('id')) {
        _this.set('user_badge', null);
      }

      // load recent badges, debounced by ten minutes
      var last_check = (user && _this.get('last_user_badge_load_for_' + user.get('id'))) || 0;
      var now = (new Date()).getTime();
      if(CoughDrop.store && user && !user.get('supporter_role') && user.get('currently_premium') && last_check < (now - 600000)) {
        _this.set('last_user_badge_load_for_' + user.get('id'), now);
        runLater(function() {
          _this.set('user_badge_hash', badge_hash);
          CoughDrop.store.query('badge', {user_id: user.get('id'), recent: 1}).then(function(badges) {
            _this.set('user_badge_hash', badge_hash);
            badges = badges.filter(function(b) { return b.get('user_id') == user.get('id'); });
            var badge = CoughDrop.Badge.best_earned_badge(badges);
            if(!badge || badge.get('dismissed')) {
              var next_badge = CoughDrop.Badge.best_next_badge(badges);
              badge = next_badge || badge;
            }
            _this.set('user_badge', badge);
          }, function(err) {
            _this.set('user_badge_hash', old_badge_hash);
          });
        });
      }
    } else if(this.get('user_badge') && this.get('user_badge.user_id') != this.get('referenced_user.id')) {
      this.set('user_badge', null);
    }
  }),
  testing: computed(function() {
    return Ember.testing;
  }),
  logging_paused: computed('stashes.logging_paused_at', function() {
    return !!stashes.get('logging_paused_at');
  }),
  current_time: computed('short_refresh_stamp', function() {
    return (this.get('short_refresh_stamp') || new Date());
  }),
  check_for_user_updated: observer('short_refresh_stamp', 'sessionUser', function(obj, changes) {
    if(window.persistence) {
      app_state.set('persistence', window.persistence);
      if(changes == 'sessionUser' || !window.persistence.get('last_sync_stamp')) {
        window.persistence.set('last_sync_stamp', this.get('sessionUser.sync_stamp'));
      }
    }
    if(this.get('sessionUser')) {
      var interval = (this.get('sessionUser.preferences.sync_refresh_interval') || (5 * 60)) * 1000;
      if(window.persistence) {
        if(window.persistence.get('last_sync_stamp_interval') != interval) {
          window.persistence.set('last_sync_stamp_interval', interval);
        }
      } else {
        console.error('persistence needed for checking user status');
      }
    }
  }),
  activate_button: function(button, obj) {
    CoughDrop.log.start();
    // skip hidden buttons
    if((button.hidden || button.empty) && !this.get('edit_mode') && this.get('currentUser.preferences.hidden_buttons') == 'grid') {
      if(!stashes.get('all_buttons_enabled')) {
        return false;
      }
    }

    // track modeling events correctly
    var now = (new Date()).getTime();
    var skip_navigation = false;
    if(app_state.get('modeling')) {
      obj.modeling = true;
    } else if(stashes.last_selection && stashes.last_selection.modeling && stashes.last_selection.ts > (now - 500)) {
      obj.modeling = true;
    }

    // update button attributes preemptively
    app_state.set('last_activation', now);
    if(button.link_disabled) {
      button = $.extend({}, button);
      setProperties(button, {
        apps: null,
        url: null,
        video: null,
        load_board: null,
        user_integration: null
      })
    }
    if(button.apps) {
      obj.type = 'app';
    } else if(button.url) {
      if(button.video && button.video.popup) {
        obj.type = 'video';
      } else {
        obj.type = 'url';
      }
    } else if(button.load_board) {
      obj.type = 'link';
    }
    var overlay = obj.overlay;
    delete obj['overlay'];

    // only certain buttons should be added to the sentence box
    var button_to_speak = obj;
    var specialty_button = null;
    var specialty = utterance.specialty_button(obj);
    var skip_speaking_by_default = !!(button.load_board || specialty || button_to_speak.special || button.url || button.apps || (button.integration && button.integration.action_type == 'render'));
    var button_added_or_spoken = false;
    if(specialty) {
      specialty_button = $.extend({}, specialty);
      specialty_button.special = true;
      if(specialty.specialty_with_modifiers) {
        if(specialty.default_speak) { 
          skip_speaking_by_default = false; 
          if(specialty.default_speak !== true) {
            obj.vocalization = specialty.default_speak;
          }
        }
        button_to_speak = utterance.add_button(obj, button);
        button_added_or_spoken = true;
      } else if(specialty.default_speak) {
        skip_speaking_by_default = false;
        obj.vocalization = specialty.default_speak;
        utterance.add_button(obj, button);
        button_added_or_spoken = true;
      }
    } else if(skip_speaking_by_default && !button.add_to_vocalization) {
    } else if(button.skip_vocalization) {
    } else {
      button_to_speak = utterance.add_button(obj, button);
      button_added_or_spoken = true;
    }

    var skip_highlight = false;
    var skip_sound = false;
    var skip_auto_return = false;
    // check if the button is part of a board that has a custom handler,
    // and skip the other actions if handled
    if(button.board == app_state.controller.get('board.model') && button.board.get('button_handler')) {
      var button_handled = button.board.get('button_handler')(button, obj);
      if(button_handled) { 
        if(button_handled.highlight === false) { skip_highlight = true; }
        if(button_handled.sound === false) { skip_sound = true; }
        if(button_handled.auto_return === false) { skip_auto_return = true; }
        if(button_handled.ignore) {
          return;
        }
      }
    }

    // speak or make a sound to show the button was selected
    if(obj.label && !skip_sound) {
      var click_sound = function() {
        if(app_state.get('currentUser.preferences.click_buttons')) {
          if(specialty_button && specialty_button.has_sound) {
          } else {
            speecher.click();
          }
        }
      };
      var vibrate = function() {
        if(app_state.get('currentUser.preferences.vibrate_buttons') && app_state.get('speak_mode')) {
          capabilities.vibrate();
        }
      };
      if(app_state.get('speak_mode')) {
        if(!skip_speaking_by_default) {
          obj.for_speaking = true;
        }

        if(app_state.get('currentUser.preferences.vocalize_buttons') || (!app_state.get('currentUser') && window.user_preferences.any_user.vocalize_buttons)) {
          if(skip_speaking_by_default && !app_state.get('currentUser.preferences.vocalize_linked_buttons') && !button.add_to_vocalization) {
            // don't say it...
            click_sound();
            vibrate();
          } else if(button_to_speak.in_progress && app_state.get('currentUser.preferences.silence_spelling_buttons')) {
            // don't say it...
            click_sound();
            vibrate();
          } else if(button.skip_vocalization) {
            // don't say it...
            click_sound();
            vibrate();
          } else {
            obj.spoken = true;
            obj.for_speaking = true;
            utterance.speak_button(button_to_speak);
            vibrate();
          }
        } else {
          click_sound();
          vibrate();
        }
      } else if(button_to_speak) {
        utterance.silent_speak_button(button_to_speak);
      }
    }

    // record the button activation in the usage logs
    if(button_to_speak.modified && !button_to_speak.in_progress) {
      obj.completion = obj.completion || button_to_speak.label;
    }
    // TODO: If the user just navigated to a home-locked board
    // then it'll be logged with a depth of 0 even though it
    // took them any number of steps to get there. On average
    // it will probably be fine, but some buttons won't get 
    // enough weight.
    obj.depth = app_state.get('depth_actions.depth') || 0; // || (stashes.get('boardHistory') || []).length;
    obj.access = app_state.get('currentUser.access_method');
    obj.overlay = !!overlay;
    stashes.log(obj);
    var _this = this;

    // highlight the button that if highlights are enabled
    if((app_state.get('referenced_user.preferences.highlighted_buttons') || 'none') != 'none' && app_state.get('speak_mode') && !skip_highlight) {
      if(button_added_or_spoken || app_state.get('referenced_user.preferences.highlighted_buttons') == 'all') {
        app_state.highlight_selected_button(button, overlay, obj.label);
      }
    }
    if(button.board) {
      button.board.prompt('clear');
    }


    // additional actions (besides just speaking) will be necessary for some buttons
    if((button.load_board && button.load_board.key) || (button.vocalization || '').match(/:native-keyboard/)) {
      var user_prefers_native_keyboard = app_state.get('referenced_user.preferences.prefer_native_keyboard');
      if(user_prefers_native_keyboard == undefined) {
        user_prefers_native_keyboard = window.user_preferences.any_user.prefer_native_keyboard;
      }
      var native_keyboard_available = capabilities.installed_app && (capabilities.system == 'iOS' || capabilities.system == 'Android') && !buttonTracker.scanning_enabled;
      if((button.vocalization || '').match(/:native-keyboard/) && native_keyboard_available && user_prefers_native_keyboard && window.Keyboard && window.Keyboard.hide) {
        scanner.native_keyboard();
      } else if(stashes.get('sticky_board') && app_state.get('speak_mode')) {
        modal.warning(i18n.t('sticky_board_notice', "Board lock is enabled, disable to leave this board."), true);
      } else {
        runLater(function() {
          app_state.track_depth('link');
          _this.jump_to_board({
            id: button.load_board.id,
            key: button.load_board.key,
            button_triggered: true,
            home_lock: button.home_lock
          }, obj.board);
        }, 50);
      }
    } else if(button.url) {
      app_state.track_depth('clear');
      if(stashes.get('sticky_board') && app_state.get('speak_mode')) {
        modal.warning(i18n.t('sticky_board_notice', "Board lock is enabled, disable to leave this board."), true);
      } else if(app_state.get('currentUser.preferences.external_links') == 'prevent') {
        modal.warning(i18n.t('external_links_disabled_notice', "External Links have been disabled in this user's preferences."), true);
      } else {
        app_state.launch_url(button, null, obj.board);
      }
    } else if(button.apps) {
      app_state.track_depth('clear');
      if(stashes.get('sticky_board') && app_state.get('speak_mode')) {
        modal.warning(i18n.t('sticky_board_notice', "Board lock is enabled, disable to leave this board."), true);
      } else if(app_state.get('currentUser.preferences.external_links') == 'prevent') {
        modal.warning(i18n.t('external_links_disabled_notice', "External Links have been disabled in this user's preferences."), true);
      } else {
        if((!app_state.get('currentUser') && (window.user_preferences.any_user.external_links || '').match(/confirm/)) || (app_state.get('currentUser.preferences.external_links') || '').match(/confirm/)) {
          modal.open('confirm-external-app', {apps: button.apps});
        } else if((!app_state.get('currentUser') && window.user_preferences.any_user.confirm_external_links) || app_state.get('currentUser.preferences.confirm_external_links')) {
          modal.open('confirm-external-app', {apps: button.apps});
        } else {
          if(capabilities.system == 'iOS' && button.apps.ios && button.apps.ios.launch_url) {
            capabilities.window_open(button.apps.ios.launch_url, '_blank');
          } else if(capabilities.system == 'Android' && button.apps.android && button.apps.android.launch_url) {
            capabilities.window_open(button.apps.android.launch_url, '_blank');
          } else if(button.apps.web && button.apps.web.launch_url) {
            capabilities.window_open(button.apps.web.launch_url, '_blank');
          } else {
            // TODO: handle this edge case smartly I guess
          }
        }
      }
    } else if(specialty_button) {
      app_state.track_depth('clear');
      var res = app_state.specialty_actions(button.vocalization);
      var auto_return_possible = !!specialty_button.default_speak || res.auto_return_possible;
      if(auto_return_possible && !res.already_navigating && !skip_auto_return) {
        app_state.possible_auto_home(obj);
      }
    } else if(button.integration && button.integration.action_type == 'webhook') {
      app_state.track_depth('clear');
      Button.extra_actions(button);
    } else if(button.integration && button.integration.action_type == 'render') {
      app_state.track_depth('clear');
      runLater(function() {
      _this.jump_to_board({
        id: "i" + button.integration.user_integration_id,
        key: "integrations/" + button.integration.user_integration_id + ":" + (button.integration.action || ''),
        home_lock: button.home_lock
      }, obj.board);
      }, 100);
    } else if(!skip_auto_return) {
      app_state.possible_auto_home(obj);
    }
    frame_listener.notify_of_button(button, obj);
    return true;
  },
  specialty_actions: function(voc) {
    var res = {auto_return_possible: false, already_navigating: false};
    (voc || '').split(/\s*&&\s*/).forEach(function(mod) {
      if(mod && mod.length > 0) {
        var found = false;
        CoughDrop.special_actions.forEach(function(action) {
          if(found) { return; }
          if(mod == action.action || (action.match && mod.match(action.match))) {
            found = true;
            if(action.trigger) {
              var trigger_res = null;
              if(action.match) {
                trigger_res = action.trigger(mod.match(action.match));
              } else {
                trigger_res = action.trigger(mod)
              }
              if(trigger_res && trigger_res.auto_return_possible) {
                res.auto_return_possible = true;
              }
              if(trigger_res && trigger_res.already_navigating) {
                res.already_navigating = true;
              }
            }
          }
        });
      }
    });
    return res;
  },
  highlight_selected_button: function(button, overlay, label_override) {
    var $button = $(".button[data-id='" + button.id + "']");
    if(overlay) {
      $button = $(overlay);
    }
    if(button.id != -1 && $button.length) {
      var $board = $(".board:first");
      var board_offset = $board.offset();
      var width = $button.outerWidth();
      var height = $button.outerHeight();
      var offset = $button.offset();
      var $clone = $button.clone().addClass('hover_button').addClass('touched');
      if(label_override) {
        $clone.find(".button-label").text(label_override);
      }
      var wait_to_fade = 1500;
      // TODO: wait_to_fade should be configurable maybe
      if(app_state.get('referenced_user.preferences.highlight_popup_text')) {
        // https://rerc-aac.psu.edu/1819-2/
        var popup_width = Math.min(400, window.innerWidth);
        var popup_height = Math.min(200, window.innerHeight - board_offset.top);
        var popup_top = Math.max(0, offset.top - board_offset.top - popup_height);
        var below = false;
        // if the popup overlaps the button
        if(popup_top + popup_height > offset.top + height) {
          // ..and there is room underneath the button
          if(window.innerHeight > offset.top + height + popup_height) {
            popup_top = offset.top - board_offset.top + height;
            below = true;
          }
        }
        wait_to_fade = 5000;
        $clone = $("<div/>").addClass('button').addClass('hover_button');
        var popup_left = offset.left + (width / 2) - board_offset.left - (popup_width / 2);
        var marg = popup_height;
        if(offset.top - board_offset.top - popup_height < 0) {
          marg = offset.top - board_offset.top;
        }
        $clone.css({
          position: 'absolute',
          top: popup_top,
          zIndex: 9,
          left: popup_left,
          width: 20,
          height: 10,
          opacity: 0.0,
          marginTop: below ? -10 : marg,
          marginLeft: (popup_width - 20) / 2,
          border: '1px solid #000',
          background: '#fff'
        });
        $clone.addClass('text_popup');
        var $canvas = $("<canvas/>");
        $canvas.attr({width: popup_width * 2, height: popup_height * 2});
        $canvas.css({
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%'
        });
        var context = $canvas[0].getContext('2d');
        var text = button.vocalization || button.label;
        var max_font_size = 120;
        var text_height = max_font_size;
        var style = Button.style(app_state.controller.get('board.button_style')) || {};
        var font_family = style.font_family || 'Arial';
  
        context.font = text_height + "px " + font_family;
        var rows = 1;
        var lines = [text];
        var max_text_width = context.measureText(text).width / 2;
        var trim_line = function(text, length) {
          var pre = length, post = length;
          while(text) {
            if(text.charAt(pre).match(/\s/)) {
              return [text.substring(0, pre), text.substring(pre + 1)];
            } else if(text.charAt(post).match(/\s/)) {
              return [text.substring(0, post), text.substring(post + 1)];
            } else if(pre <= 0 && post >= text.length) {
              return [text, ""];  
            } else {
              pre--;
              post++;
            }
          }
        }
        var stay_put = false;
        var max_lines = 4;
        while(max_text_width > popup_width && rows <= max_lines) {
          var text_cutoff = (rows == max_lines || stay_put) ? 50 : 80;
          while(text_height > text_cutoff && max_text_width > popup_width) {
            var widths = [];
            text_height = text_height - 10;
            context.font = text_height + "px " + font_family;
            max_text_width = Math.max.apply(null, lines.map(function(l) { return context.measureText(l).width; })) / 2;
          }
          if(max_text_width > popup_width && rows < max_lines && !stay_put) {
            rows++;
            var last_lines = lines;
            lines = [];
            var line_length = text.length / rows;
            var leftover = text;
            for(var i = 0; i < rows; i++) {
              if(i == rows - 1) {
                lines.push(leftover);
              } else {
                var arr = trim_line(leftover, line_length);
                leftover = arr[1];
                lines.push(arr[0]);
              }
            }
            var last_max_length = Math.max.apply(null, last_lines.map(function(l) { return l.length; }));
            var new_max_length = Math.max.apply(null, lines.map(function(l) { return l.length; }));
            if(last_max_length == new_max_length) {
              stay_put = true;
              lines = last_lines;
            }
            text_height = max_font_size + 20 - (lines.length * 10);
          }
        }
        context.textAlign = 'center';
        context.fillStyle = '#000';
        context.measureText(text);
        var text_top = popup_height - ((text_height + 5) * lines.length / 2);
        lines.forEach(function(line, idx) {
          context.fillText(line, popup_width, text_top - (text_height / 6) + ((text_height + 5) * (idx + 1)));
        });

        $clone.append($canvas);
        runLater(function() {
          $clone.css({
            width: 400,
            height: 200,
            opacity: 1.0,
            marginLeft: Math.min(Math.max(0, -1 * popup_left + 5), window.innerWidth - popup_left - popup_width - 5),
            marginTop: below ? 10 : -10
          })
        });
        runLater(function() {
          $clone.css({
            width: 20,
            height: 10,
            opacity: 0.0,
            marginTop: below ? -10 : marg,
            marginLeft: (popup_width - 20) / 2,
          });
        }, wait_to_fade);
        // pop-up speech
      } else {
        $clone.css({
          position: 'absolute',
          top: offset.top - board_offset.top,
          left: offset.left - board_offset.left,
          width: width + 8,
          height: height + 8,
          margin: -4
        });
      }

      $board.append($clone);
      $clone.addClass('selecting');
      $clone.addClass('clone');

      // Have to reposition of moving to/from keyboard suggestion board
      var offset_y = $("#word_suggestions").height() || 0;
      var checky = function() {
        if(!$clone.removed) {
          var new_offset_y = $("#word_suggestions").height() || 0;
          if(offset_y != new_offset_y) {
            var top = parseInt($clone.css('top'), 10);
            top = top + (offset_y - new_offset_y);
            offset_y = new_offset_y;
            $clone.css('top', top);
          }
          runLater(checky, 100);
        }
      };
      runLater(checky);

      runLater(function() {
        $clone.addClass('fading');
        $button.addClass('selecting');
        var later = runLater(function() {
          $clone.removed = true;
          $button.removeClass('selecting');
          $button.data('later', null);
          $clone.remove();
        }, 3000);
        $button.data('later', later);
      }, wait_to_fade);
    }
  },
  possible_auto_home: function(obj) {
    app_state.track_depth('clear');
    if(obj.prevent_return) {
      // integrations and configured buttons can explicitly prevent navigating away when activated
    } else if(app_state.get('speak_mode') && ((!app_state.get('currentUser') && window.user_preferences.any_user.auto_home_return) || app_state.get('currentUser.preferences.auto_home_return'))) {
      if(stashes.get('sticky_board') && app_state.get('speak_mode')) {
        var state = stashes.get('temporary_root_board_state') || stashes.get('root_board_state');
        var current = app_state.get('currentBoardState');
        if(state && current && state.key == current.key) {
        } else {
          modal.warning(i18n.t('sticky_board_notice', "Board lock is enabled, disable to leave this board."), true);
        }
      } else if(obj && obj.vocalization && obj.vocalization.match(/^\+/)) {
        // don't home-return when spelling out words
      } else {
        app_state.jump_to_root_board({auto_home: true});
      }
    }
  },
  eval_mode: computed('currentBoardState.key', function() {
    return (this.get('currentBoardState.key') || '').match(/^obf\/eval/);
  }),
  launch_url: function(button, force, board) {
    var _this = this;
    if(!force && _this.get('currentUser.preferences.external_links') == 'confirm_all') {
      modal.open('confirm-external-link', {url: button.url}).then(function(res) {
        if(res && res.open) {
          _this.launch_url(button, true, board);
        }
      });
    } else {
      var real_url = button.url;
      var book_integration = _this.get('sessionUser.global_integrations.tarheel');
      book_integration = book_integration || ((window.user_preferences || {}).global_integrations || []).indexOf('tarheel') != -1;
      if(button.book && button.book.popup && button.book.url) {
        real_url = button.book.url;
      }
      if(button.video && button.video.popup) {
        modal.open('inline-video', button);
      } else if(button.book && button.book.popup && book_integration) {
        var opts = $.extend({}, button.book || {});
        delete opts['base_url'];
        delete opts['url'];
        delete opts['popup'];
        delete opts['type'];
        runLater(function() {
          _this.jump_to_board({
            id: "i_tarheel",
            key: "integrations/tarheel:" + encodeURIComponent(btoa(JSON.stringify(opts))),
            home_lock: button.home_lock
          }, board);
        }, 100);
      } else {
        var do_confirm = (!_this.get('currentUser') && window.user_preferences.any_user.external_links == 'confirm_custom') || _this.get('currentUser.preferences.external_links') == 'confirm_custom';
        do_confirm = do_confirm || (!_this.get('currentUser') && window.user_preferences.any_user.confirm_external_links) || _this.get('currentUser.preferences.confirm_external_links');
        if(!force && do_confirm) {
          modal.open('confirm-external-link', {url: button.url, real_url: real_url}).then(function(res) {
            if(res && res.open) {
              capabilities.window_open(real_url || button.url, '_blank');
            }
          });
        } else {
          capabilities.window_open(real_url || button.url, '_blank');
        }
      }
    }
  },
  remember_global_integrations: observer('sessionUser.global_integrations', function() {
    if(this.get('sessionUser.global_integrations')) {
      stashes.persist('global_integrations', this.get('sessionUser.global_integrations'));
    }
  }),
  toggle_cookies: observer('sessionUser.preferences.cookies', function(state, change) {
    if(change == 'sessionUser.preferences.cookies') {
      state = !!this.get('sessionUser.preferences.cookies');
    }
    if(state === true) {
      // If changed on the user preferences page, or they haven't explicitly said
      // 'No Thanks' on the popup, go ahead and enable cookies and tracking
      if(!change || this.get('sessionUser.watch_cookies') || localStorage['enable_cookies'] != 'explicit_false') {
        if(!window.ga && window.ga_setup) {
          window.ga_setup();
        }
        localStorage['enable_cookies'] = 'true';
      }
    } else if(state === false) {
      window.ga = null;
      localStorage['enable_cookies'] = 'false';
    }
    if(localStorage['enable_cookies']) {
      var elem = document.getElementById('cookies_prompt');
      if(elem) {
        elem.style.display = 'none';
        elem.setAttribute('data-hidden', 'true');
      }
    }
  }),
  board_virtual_dom: computed(function() {
    var _this = this;
    var dom = {
      sendAction: function() {
      },
      trigger: function(event, id, args) {
        if(app_state.get('currentUser.preferences.device.canvas_render')) {
          if(CoughDrop.customEvents[event]) {
            dom.sendAction(CoughDrop.customEvents[event], id, {event: args});
          }
        }
      },
      each_button: function(callback) {
        var rows =_this.get('board_virtual_dom.ordered_buttons') || [];
        var idx = 0;
        rows.forEach(function(row) {
          row.forEach(function(b) {
            if(!b.get('empty_or_hidden')) {
              b.idx = idx;
              idx++;
              callback(b);
            }
          });
        });
      },
      add_state: function(state, id) {
        if(state == 'touched' || state == 'hover') {
          dom.clear_state(state, id);
          dom.each_button(function(b) {
            if(b.id == id && !emberGet(b, state)) {
              emberSet(b, state, true);
              dom.sendAction('redraw', b.id);
            }
          });
        }
      },
      clear_state: function(state, except_id) {
        dom.each_button(function(b) {
          if(b.id != except_id && emberGet(b, state)) {
            emberSet(b, state, false);
            dom.sendAction('redraw', b.id);
          }
        });
      },
      clear_touched: function() {
        dom.clear_state('touched');
//        dom.sendAction('redraw');
      },
      clear_hover: function() {
        dom.clear_state('hover');
//        dom.sendAction('redraw');
      },
      button_result: function(b) {
        var pos = b.positioning;
        return {
          id: b.id,
          left: pos.left,
          top: pos.top,
          width: pos.width,
          height: pos.height,
          button: true,
          index: b.idx
        };
      },
      button_from_point: function(x, y) {
        var res = null;
        if(app_state.get('currentUser.preferences.device.canvas_render')) {
          dom.each_button(function(b) {
            var pos = b.positioning;
            if(!b.hidden) {
              if(x > pos.left - 2 && x < pos.left + pos.width + 2) {
                if(y > pos.top - 2 && y < pos.top + pos.height + 2) {
                  res = dom.button_result(b);
                }
              }
            }
          });
        }
        return res;
      },
      button_from_index: function(idx) {
        var res = null;
        dom.each_button(function(b) {
          if(b.idx == idx || (idx == -2)) {
            res = dom.button_result(b);
          }
        });
        return res;
      },
      button_from_id: function(id) {
        var res = null;
        dom.each_button(function(b) {
          var pos = b.positioning;
          if(b.id == id) {
            res = dom.button_result(b);
          }
        });
        return res;
      }
    };
    return dom;
  })
}).create({
});

if(!app_state.get('testing')) {
  app_state.set('refresh_stamp', (new Date()).getTime());
  app_state.set('medium_refresh_stamp', (new Date()).getTime());
  app_state.set('short_refresh_stamp', (new Date()).getTime());
  setInterval(function() {
    app_state.set('refresh_stamp', (new Date()).getTime());
  }, 5*60*1000);
  setInterval(function() {
    app_state.set('medium_refresh_stamp', (new Date()).getTime());
  }, 60*1000);
  setInterval(function() {
    app_state.set('short_refresh_stamp', (new Date()).getTime());
    if(window.persistence) {
      window.persistence.set('refresh_stamp', (new Date()).getTime());
    } else {
      console.error('persistence needed for setting refresh stamp');
    }
  }, 500);
}

app_state.ScrollTopRoute = Route.extend({
  activate: function() {
    this._super();
    if(!this.get('already_scrolled')) {
      this.set('already_scrolled', true);
      $('body').scrollTop(0);
    }
  }
});
window.app_state = app_state;
export default app_state;
