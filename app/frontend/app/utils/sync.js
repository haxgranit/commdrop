import CoughDrop from '../app';
import EmberObject from '@ember/object';
import stashes from './_stashes';
import persistence from './persistence';
import app_state from './app_state';
import modal from './modal';
import speecher from './speecher';
import $ from 'jquery';
import {
  set as emberSet,
  get as emberGet
} from '@ember/object';
import {
  later as runLater,
  cancel as runCancel,
} from '@ember/runloop';
var sync = EmberObject.extend({
  subscribe: function(opts) {
    return new Promise(function(resolve, reject) {
      var now = (new Date()).getTime();
      var sub = sync.con.subscriptions.subscriptions.find(function(s) { return s.user_id == opts.user_id; });
      if(sub && sub.started < (now - (60 * 60 * 1000))) {
        // TODO: wait until connection succeeds befor stopping prior
        sub.unsubscribe();
        sub = null;
      }
      sub = sub || sync.con.subscriptions.create({
        channel: "RoomChannel",
        room_id: opts.room_id,
        user_id: opts.ws_user_id,
        verifier: opts.verifier
      }, {
        received: function(data) {
          if(data.sender_id && data.sender_id == opts.ws_user_id) {
            // Rebroadcast of my own message, ignore
            return;
          }
          console.log("CDWS Data", sub.user_id, data); 
          sync.listeners = sync.listeners || {};
          if(data.partner_id == opts.ws_user_id) {
            data.partner_is_self = true;
          }
          if(data.communicator_id == opts.ws_user_id) {
            data.communicator_is_self = true;
          }
          if(data.preferred_communicator_id == opts.ws_user_id) {
            data.preferred_communicator_is_self = true;
          }
          if(data.paired_communicator_id == opts.ws_user_id) {
            data.paired_communicator_is_self = true;
          }
          if(data.paired_partner_id == opts.ws_user_id) {
            data.paired_partner_is_self = true;
          }
          if(data.type == 'users' || (data.type == 'update' && data.user_id.match(/^me/))) {
            sub.last_communicator_access = parseInt(data.last_communicator_access, 10) || 0;
            if(data.type == 'update') {
              sub.last_communicator_access = sub.last_communicator_access || ((new Date()).getTime() / 1000);
            }
            var sup = app_state.get('sessionUser.known_supervisees').find(function(sup) { return sup.id == sub.user_id; });
            if(sup) {
              var cutoff = ((new Date()).getTime() - (10 * 60 * 1000)) / 1000;
              console.log("SUP", sup.user_name, data, cutoff);
              emberSet(sup, 'online', sub.last_communicator_access > cutoff);
            }
            var user = CoughDrop.store.peekRecord('user', sub.user_id);
            if(user) {
              user.set('last_ws_access', sub.last_communicator_access);
            }
          }
          for(var key in sync.listeners) {
            sync.listeners[key]({
              user_id: opts.user_id,
              type: data && data.type,
              data: data
            });
          }
        },
        connected: function() {
          runLater(function() {
            sub.send({type: 'users'});
          }, 200);
          resolve();
        },
        rejected: function() {
          // TODO: can we recover from this?
          sub.active = false;
          reject();
        }
      });  
      sub.user_id = opts.user_id;
      sub.ws_user_id = opts.ws_user_id;
      sub.started = sub.started || now;
    });
  },
  last_accesses: function() {
    if(!sync.con) { return {}; }
    var res = {};
    sync.con.subscriptions.subscriptions.forEach(function(sub) {
      if(sub.last_communicator_access != undefined) {
        res[sub.user_id] = sub.last_communicator_access;
      }
    });
    return res;
  },
  connect: function(user) {
    // TODO: call connect every 2-ish hours
    // Need a way to replace device_id without
    // needing to re-pair
    var connect_promise = new Promise(function(resolve, reject) {
      if(!window.ActionCable) { return reject({error: 'no ActionCable'}); }
      if(stashes.get('ws_url') && !sync.con) {
        sync.con = window.ActionCable.createConsumer(stashes.get('ws_url'));
      }
      user = user || app_state.get('sessionUser');
      if(user && !user.sync_connected && (!user.get('supporter_role') || user.get('supervisees.length'))) {
        user.sync_connected = true;
        if(sync.pending_connect) { return sync.pending_connect; }
        sync.pending_connect = connect_promise;
        persistence.ajax('/api/v1/users/self/ws_settings', {type: 'GET'}).then(function(res) {
          res.retrieved = (new Date()).getTime();
          var cached_settings = stashes.get('ws_settings');
          // Reuse cached settings if not too old so
          // we don't lose the existing pairing
          if(cached_settings && cached_settings.user_id == res.user_id && cached_settings.retrieved && cached_settings.retrieved > (res.retrieved - (3 * 60 * 60 * 1000))) {
            res = cached_settings;
          }
          res = Object.assign({}, res);
          delete res['meta'];
          if(user.get('id') == app_state.get('sessionUser.id')) {
            stashes.persist('ws_settings', res);
          }
          sync.pending_connect = false;
          sync.self_settings = res;
          var promises = [];
          if(!user.get('supporter_role')) {
            promises.push(sync.subscribe({
              user_id: res.user_id,
              ws_user_id: res.my_device_id,
              room_id: res.ws_user_id,
              verifier: res.verifier
            }));
          }
          if(res.supervisees) {
            res.supervisees.forEach(function(sup) {
              promises.push(sync.subscribe({
                user_id: sup.user_id,
                ws_user_id: sup.my_device_id,
                room_id: sup.ws_user_id,
                verifier: sup.verifier
              }));
            });
          }
          if(promises.length == 0) {
            resolve();
          } else {
            promises[0].then(function(res) {
              resolve(res);
            }, function(err)  {
              reject(err);
            })
          }
        }, function(err) {
          sync.pending_connect = false;
          reject(err);
        });
      } else {
        resolve();
      }
    });
    return connect_promise;
  },
  listen: function(listen_id, callback) {
    sync.listeners = sync.listeners || {};
    sync.listeners[listen_id] = callback;
  },
  user_lookup: function(ws_user_id) {
    // API call to get user's info, check for cache first
    return new Promise(function(resolve, reject) {
      sync.user_lookups = sync.user_lookups || {};
      if(sync.user_lookups[ws_user_id]) {
        resolve(sync.user_lookups[ws_user_id]);
      } else {
        persistence.ajax("/api/v1/users/" + encodeURIComponent(ws_user_id) + "/ws_lookup", {type: 'GET'}).then(function(user) {
          sync.user_lookups[ws_user_id] = user;
          resolve(user);
        }, function(err) {
          reject(err);
        });
      }
    });
  },
  pair_as: function(role, user_id, other_ws_user_id, pair_code) {
    if(role == 'none') {
      // if already pairing for the specified user_id, end it
      if(sync.current_pairing && sync.current_pairing.room_user_id == user_id) {
        app_state.set('pairing', null);
        sync.current_pairing = null;
        // app_state.end_pair();
      }
      return;
    }
    if(sync.current_pairing && sync.current_pairing.pair_code == pair_code) {
      // already paired
      return;
    }
    sync.user_lookup(other_ws_user_id).then(function(other_user) {
      sync.current_pairing = {
        started: (new Date()).getTime(),
        room_user_id: user_id,
        role: role,
        other_user_id: other_user.user_id,
        other_user: other_user,
        pair_code: pair_code
      };
      // set pairing state
      CoughDrop.store.findRecord('user', other_user.user_id).then(function(u) {
        var communicator_id = role == 'partner' ? u.get('id') : app_state.get('sessionUser.id');
        app_state.set('pairing', {partner: role == 'partner', model: true, user_id: u.get('id'), user: u, communicator_id: communicator_id});
      });
    });
  },
  keepalive: function() {
    if(!sync.con) { return; }
    sync.con.subscriptions.subscriptions.forEach(function(sub) {
      sync.send(sub.user_id, {type: 'keepalive', following: (app_state.get('pairing.user_id') == sub.user_id)});
    })
  },
  send_update: function(user_id, button_obj) {
    // generate an id for the update,
    // if currently-paired then keep sending
    // it and queue other updates until the 
    // current update is confirmed
    sync.cached_updates = sync.cached_updates || [];
    var update_id = (new Date()).getTime() + "." + Math.random();
    var update = {
      type: 'update',
      update_id: update_id,
      last_action: app_state.get('last_activation'),
      speak_mode: app_state.get('speak_mode')
    };
    if(!app_state.get('sessionUser.preferences.remote_modeling')) {
      // If remote support is completely disabled, don't send anything
      return;
    }
    if(app_state.get('pairing') || app_state.get('sessionUser.preferences.remote_modeling_auto_follow')) {
      // If paired, or allowing auto-followers, include current state
      if(app_state.get('speak_mode')) {
        if(button_obj) {
          update.current_action = {type: 'button', id: button_obj.button_id, board_id: button_obj.board.id, source: button_obj.source};
        }
        update.board_state = {
          id: app_state.get('currentBoardState.id'),
          level: app_state.get('currentBoardState.level'),
        };
        if(app_state.get('pairing') && sync.current_pairing && sync.current_pairing) {
          update.paired = true;
        }
      } else {
        // Remember, you may have a pairing in-process,
        // so you only really know you're unpaired if
        // there's no way you could be paired
        update.unpaired = true;
      }
    }
    if(update.board_state && !update.current_action && update.board_state.id == sync.last_board_id_assertion && app_state.get('sessionUser.id') != user_id) {
      // When someone else navigates you to a board,
      // don't assert that board or you can end up
      // in a bad loop
      return;
    }
    
    // TODO: if paired as partner,
    // - modeling: send force_state
    //     (button hits will initially highlight, the
    //      partner can double-hit them to manually select)
    // - following: whatever

    var send_it = function(update) {
      sync.send(user_id, update);
      if(sync.pending_update_id == update.update_id && update.attempts < 20) {
        update.attempts = (update.attempts || 0) + 1;
        runLater(function() {
          if(sync.pending_update_id == update.update_id) {
            send_it(update);
          }
        }, 500);
      } else if(sync.cached_updates.length > 0) {
        runLater(function() {
          var update = sync.cached_updates.shift();
          sync.pending_update_id = update.update_id;
          send_it(update);
        }, 500);
      } else {
        sync.pending_update_id = null;
      }
    };
    if(sync.current_pairing && sync.current_pairing.room_user_id == user_id) {
      if(sync.pending_update_id) {
        sync.cached_updates.push(update);
        // queue the update to send later
      } else {
        sync.pending_update_id = update_id;
        send_it(update);
      }
    } else {
      send_it(update);
    }
  },
  confirm_pair: function(code, partner_id) {
    sync.send(app_state.get('sessionUser.id'), {
      type: 'accept',
      pair_code: code,
      partner_id: partner_id
    });
  },
  request_pair: function(user_id) {
    if(sync.pending_pair_request_promise) {
      sync.pending_pair_request_promise.reject('cancelled');
    }
    return new Promise(function(resolve, reject) {
      var pair_code = (new Date()).getTime() + "." + Math.random();
      var promise = {
        user_id: user_id,
        pair_code: pair_code,
        resolve: function(result) { 
          if(sync.pending_pair_request_promise == promise) {
            sync.pending_pair_request_promise = null;
          }
          resolve(result);
        },
        reject: function(error) { 
          if(sync.pending_pair_request_promise == promise) {
            sync.pending_pair_request_promise = null;
          }
          reject(error); 
        }
      };        
      sync.pending_pair_request_promise = promise;
      sync.pair_code = {user_id: user_id, code: pair_code};
      // send out on a loop until confirmed
      var attempts = 0;
      var send_request = function() {
        attempts++;
        if(sync.pair_code && sync.pair_code.code == pair_code) {
          if(attempts > (5 * 60)) {
            // Try for 5 minutes, then give up
            promise.reject('timed out');
            sync.pair_code = null;
          } else {
            sync.send(user_id, {
              type: 'request',
              pair_code: sync.pair_code.code
            });
            runLater(send_request, 1000);
          }
        }
      };
      send_request();  
    });
  },
  default_listen: function() {
    sync.listen('default_listeners', function(message) {
      var matched = false;
      if(message.user_id == app_state.get('sessionUser.id')) {
        matched = true;
        // Message in my room!
        if(message.type == 'pair_request') {
          var auto_accept = app_state.get('sessionUser.preferences.remote_modeling_auto_accept');
          if(app_state.get('speak_mode')) {
            // Someone sent a pair request
            if(!app_state.get('sessionUser.preferences.remote_modeling')) {
              // Reject if pairing is disabled
              sync.send(app_state.get('sessionUser.id'), {
                type: 'reject',
                pair_code: message.data.pair_code,
                partner_id: message.data.partner_id
              });
            } else if(message.data.preferred_communicator_is_self) {
              // They want to pair with this device
              sync.confirm_pair(message.data.pair_code, message.data.partner_id);
            } else if(auto_accept && message.data.communicator_ids.length < 2) {
              // If auto-accept is enabled and there's
              // only one active communicator device in the channeel
              sync.confirm_pair(message.data.pair_code, message.data.partner_id);
            } else {
              sync.handled_pair_codes = sync.handled_pair_codes || [];
              if(sync.handled_pair_codes.indexOf(message.data.pair_code) == -1) {
                sync.handled_pair_codes.push(message.data.pair_code);
                sync.handled_pair_codes = sync.handled_pair_codes.slice(-5);
                sync.user_lookup(message.data.partner_id).then(function(user) {
                  // Note the pair request, wait for user response
                  app_state.set('sessionUser.request_alert', {type: 'model', user: user, pair: message.data});
                  // sync.confirm_pair(message.data.pair_code, message.data.partner_id);
                });
              }
            }
          } else {
            sync.send(app_state.get('sessionUser.id'), {
              type: 'reject',
              pair_code: message.data.pair_code,
              partner_id: message.data.partner_id
            });
          }
        } else if(message.type == 'query') {
          // Someone asked for an update
          sync.send_update(message.user_id);
        }
      } else {
        // Check if it's for one of my supervisees
        var sup = (app_state.get('sessionUser.all_supervisees') || app_state.get('sessionUser.supervisees')).find(function(s) { return s.id == message.user_id });
        if(app_state.get('focused_user.id') == message.user_id) {
          sup = app_state.get('focused_user');
        }
        if(sup) {
          matched = true;
          // Message to one of my supervisee rooms
          emberSet(sup, 'last_action', Math.max(sup.last_action || 0, message.data.last_action));
        }
      }
      if(matched) {
        if(message.type == 'pair_confirm') {
          if(message.data.communicator_is_self) {
            // You are paired as the communicator!
            sync.pair_as('communicator', message.user_id, message.data.partner_id, message.data.pair_code);
          } else if(message.data.partner_is_self) {
            // You are paired as the partner!
            // TODO: we should have the communicator's info cached
            if(sync.pending_pair_request_promise && sync.pending_pair_request_promise.pair_code == message.data.pair_code) {
              sync.pending_pair_request_promise.resolve();
              sync.pair_as('partner', message.user_id, message.data.communicator_id, message.data.pair_code);
            } else {
              // something barfed
              debugger
            }
          } else {
            // You are not paired with this user
            if(sync.pending_pair_request_promise && sync.pending_pair_request_promise.user_id == message.user_id) {
              sync.pending_pair_request_promise.reject('paired with someone else');
            }
            sync.pair_as('none', message.user_id, null, message.data.pair_code);
          }
          if(sync.pair_code && sync.pair_code.user_id == message.user_id) {
            sync.pair_code = null;
          }
        } else if(message.type == 'pair_reject') {
          if(sync.pending_pair_request_promise && sync.pending_pair_request_promise.pair_code == message.data.pair_code) {
            sync.pending_pair_request_promise.reject('rejected');
          }
        } else if(message.type == 'confirm') {
          // Update confirmed by partner, stop retrying
          if(message.data.update_id == sync.pending_update_id) {
            sync.pending_update_id = null;
          }
        } else if(message.type == 'update') {
          if(message.data.pair_code == sync.pair_code) {
            sync.pair_code = null;
          }
          if(message.data.update_id) {
            sync.recent_update_ids = sync.recent_update_ids || [];
            // Send confirmation if currently-paired
            if(message.data.paired_communicator_is_self || message.data.paired_partner_is_self) {
              sync.send(message.user_id, {
                type: 'confirm',
                update_id: message.data.update_id
              });
            }
            // Don't process the same update more than once
            if(sync.recent_update_ids.indexOf(message.data.update_id) != -1) {
              return;              
            }
            sync.recent_update_ids.push(message.data.update_id);
            sync.recent_update_ids = sync.recent_update_ids.slice(-50);
          }
          if(message.data.paired_communicator_is_self) {
            // You are paired as the communicator!
            sync.pair_as('communicator', message.user_id, message.data.paired_partner_id, message.data.pair_code);
          } else if(message.data.paired_partner_is_self) {
            // You are paired as the partner!
            sync.pair_as('partner', message.user_id, message.data.paired_communicator_id, message.data.pair_code);
          } else if(message.data.paired_communicator_id) {
            // You are not paired or your pair has ended with this user
            sync.pair_as('none', message.user_id, null, message.data.pair_code);
          } else {
            // No one is paired with this communicator
            sync.pair_as('none', message.user_id, null, message.data.pair_code);
          }
          var following = false;
          if(!modal.is_open()) {
            // Don't navigate when a modal is open
            if(app_state.get('pairing.communicator_id') == message.user_id) {
              // Only update when it's for the room you're following/paired in
              if(app_state.get('pairing.model')) {
                // When modeling, we follow both directions
                following = true;
              } else if(app_state.get('pairing.user_id') == message.user_id) {
                // Otherwise only the non-communicator should update
                following = true;
              }
            }
          }

          // TODO: warn if getting data from multiple devices at once
          // TODO: if paired, only listen to updates from the paired device
          // TODO: this is what what following looks like
          if(app_state.get('speak_mode') && following) {
            if(message.data.board_state) {
              CoughDrop.store.findRecord('board', message.data.board_state.id).then(function(board) {
                sync.handle_action({type: 'board_assertion', board: board});
                if(message.data.current_action) {
                  console.log("OTHER PERSON HIT A BUTTON", message.data);
                  sync.handle_action(message.data.current_action);
                }
              });
            }
          }
        } else if(message.type == 'pair_end') {
          // You are not paired with this user
          sync.pair_as('none', message.user_id, null, message.data.pair_code);
        }
      }
    });
  },
  next_action: function() {
    if(sync.next_action.timer) {
      return;
    }
    sync.pending_actions = sync.pending_actions || [];
    var action = sync.pending_actions.shift();
    if(action) {
      if(action.type == 'board_assertion') {
        var did_change = false;
        if(app_state.get('currentBoardState.id') != action.board.get('id')) {
          did_change = true;
          speecher.click('click');
          sync.last_board_id_assertion = action.board.get('id');
          app_state.jump_to_board({
            id: action.board.get('id'),
            key: action.board.get('key'),
          });  
        }
        sync.next_action.timer = runLater(function() {
          sync.next_action.timer = null;
          sync.next_action();
        }, did_change ? 500 : 50);
      } else if(action.type == 'button') {
        if(app_state.get('currentBoardState.id') == action.board_id) {
          var $button = $(".button[data-id='" + action.id + "']");
          speecher.click('ding');
          console.log("BUTTON SOURCE", action);
          var icon = 'hand-up';
          // click, completion, tag, overlay, switch, keyboard,
          // expression, keyboard_control, dwell, 
          // longpress, gamepad
          if(action.source == 'dwell') {
            icon = 'screenshot';
          } else if(action.source == 'switch') { 
            icon = 'record';
          } else if(action.source == 'expression') {
            icon = 'sunglasses';
          } else if(action.source == 'keyboard') {
            icon = 'text-background';
          } else if(action.source == 'gamepad') {
            icon = 'tower';
          }

          modal.highlight($button, {clear_overlay: true, icon: icon}).then(function() {
            modal.close_highlight();
          }, function() { });
          sync.next_action.timer = runLater(function() {
            sync.next_action.timer = null;
            modal.close_highlight();
            sync.next_action();
          }, 1500);
        }
      }
    }
  },
  handle_action: function(action) {
    sync.pending_actions = sync.pending_actions || [];
    sync.pending_actions.push(action);
    sync.next_action();
  },
  stop_listening: function(listen_id) {
    sync.listeners = sync.listeners || {};
    delete sync.listeners[listen_id];
  },
  send: function(user_id, message_obj) {
    var sub = sync.con && sync.con.subscriptions.subscriptions.find(function(s) { return s.user_id == user_id; });
    if(!sub) { return false; }
    message_obj.sender_id = sub.ws_user_id;
    sub.send(message_obj);
    return true;
  }
}).create({ });

window.sync = sync;
export default sync;
