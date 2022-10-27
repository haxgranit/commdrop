import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
import { queryLog, db_wait, fake_dbman } from 'frontend/tests/helpers/ember_helper';
import Ember from 'ember';
import persistence from '../../utils/persistence';
import speecher from '../../utils/speecher';
import coughDropExtras from '../../utils/extras';
import app_state from '../../utils/app_state';
import modal from '../../utils/modal';
import stashes from '../../utils/_stashes';
import editManager from '../../utils/edit_manager';
import capabilities from '../../utils/capabilities';
import contentGrabbers from '../../utils/content_grabbers';
import CoughDrop from '../../app';

describe("persistence", function() {
  var app = null;
  var dbman;
  var pictureGrabber = contentGrabbers.pictureGrabber;
  var soundGrabber = contentGrabbers.soundGrabber;
  var dbg = function() {
    debugger;
  };
  beforeEach(function() {
    app = {
      register: function(key, obj, args) {
        app.registered = (key === 'cough_drop:persistence' && obj === persistence && args.singleton === true);
      },
      inject: function(component, name, key) {
        if(name === 'persistence' && key === 'cough_drop:persistence') {
          app.injections.push(component);
        }
      },
      injections: []
    };
    stashes.set('current_mode', 'default');
    app_state.set('currentBoardState', null);
    app_state.set('sessionUser', null);
    stub(speecher, 'load_beep', function() { return Ember.RSVP.resolve({}); });
    dbman = capabilities.dbman;
    capabilities.dbman = fake_dbman();
  });
  afterEach(function() {
    capabilities.dbman = dbman;
  });

  var board = null;
  function push_board(callback) {
    db_wait(function() {
      CoughDrop.store.push('board', {
        id: '1234',
        name: 'Best Board'
      });
      var record = null;
      CoughDrop.store.find('board', '1234').then(function(res) {
        record = res;
      });
      var _this = this;
      waitsFor(function() { return record; });
      runs(function() {
        board = record;
        Ember.run(_this, callback);
      });
    });
  }

  describe("setup", function() {
    it("should properly inject settings", function() {
      persistence.setup({}, app);
      expect(app.registered).toEqual(true);
      expect(app.injections).toEqual(['model', 'controller', 'view', 'route']);
    });
    it("should default last_sync to zero", function() {
      db_wait(function() {
        persistence.remove('settings', {storageId: 'lastSync'}, 'lastSync').then(function() {
          setTimeout(function() {
            persistence.setup({}, app);
          }, 10);
        });
        waitsFor(function() { return persistence.get('last_sync_at') === 0; });
        runs();
      });
    });
    it("should check for last_sync if set", function() {
      db_wait(function() {
        persistence.store('settings', {last_sync: 12345}, 'lastSync').then(function() {
          setTimeout(function() {
            persistence.setup({}, app);
          }, 50);
        });
        waitsFor(function() { return persistence.get('last_sync_at') === 12345; });
        runs();
      });
    });
  });

  describe("find", function() {
    it("should error if db isn't ready", function() {
      var ready = coughDropExtras.get('ready');
      coughDropExtras.set('ready', false);
      var res = persistence.find('bob', 'ok');
      var error = null;
      res.then(function() { dbg(); }, function(err) {
        error = err;
      });
      waitsFor(function() { return error; });
      runs(function() {
        coughDropExtras.set('ready', ready);
        expect(error.error).toEqual("extras not ready");
      });
    });
    it("should return a promise", function() {
      var res = persistence.find('bob', 'ok');
      expect(res.then).not.toEqual(null);
      res.then(null, function() { });
    });
    it("should fail on invalid store types", function() {
      db_wait(function() {
        var error = null;
        persistence.find('bob', 'ok').then(function() { }, function(err) {
          error = err;
        });
        waitsFor(function() { return error; });
        runs(function() {
          expect(error.error).toEqual("invalid type: bob");
        });
      });
    });
    it("should return the found result", function() {
      db_wait(function() {
        var rnd = persistence.temporary_id();
        var record = null;
        var obj = {
          raw: {hat: rnd},
          storageId: 'hat'
        };
        coughDropExtras.storage.store('settings', obj, 'hat').then(function() {
          setTimeout(function() {
            persistence.find('settings', 'hat').then(function(res) {
              record = res;
            });
          }, 10);
        });
        waitsFor(function() { return record; });
        runs(function() {
          expect(record.hat).toEqual(rnd);
        });
      });
    });
    it("should mark the result if too old", function() {
      db_wait(function() {
        var rnd = persistence.temporary_id();
        var record = null;
        var ids = {
          raw: {ids: []},
          storageId: 'importantIds'
        };
        var obj = {
          raw: {hat: rnd},
          storageId: 'hat',
          persisted: 1234
        };
        coughDropExtras.storage.store('settings', obj, 'hat').then(function() {
          setTimeout(function() {
            coughDropExtras.storage.store('settings', ids, 'importantIds').then(function() {
              setTimeout(function() {
                persistence.find('settings', 'hat').then(function(res) {
                  record = res;
                });
              }, 10);
            });
          }, 10);
        });
        waitsFor(function() { return record; });
        runs(function() {
          expect(record.outdated).toEqual(true);
        });
      });
    });
    it("should return the found result if too old but marked as important", function() {
      db_wait(function() {
        var rnd = persistence.temporary_id();
        var record = null;
        var obj = {
          raw: {hat: rnd},
          storageId: 'hat',
          persisted: 1234
        };
        var ids = {
          raw: {ids: ['settings_hat']},
          storageId: 'importantIds'
        };
        coughDropExtras.storage.store('settings', obj, 'hat').then(function() {
          setTimeout(function() {
            coughDropExtras.storage.store('settings', ids, 'importantIds').then(function() {
              setTimeout(function() {
                persistence.find('settings', 'hat').then(function(res) {
                  record = res;
                });
              }, 10);
            });
          }, 10);
        });
        waitsFor(function() { return record; });
        runs(function() {
          expect(record.hat).toEqual(rnd);
          expect(record.important).toEqual(true);
          expect(record.outdated).toEqual(true);
        });
      });
    });
  });

  describe("remember_access", function() {
    it("should stash accesses", function() {
      stashes.persist('recent_boards', []);
      persistence.remember_access('find', 'board', 'bob/cool');
      expect(stashes.get('recent_boards')).toEqual([{id: 'bob/cool'}]);
      persistence.remember_access('find', 'board', 'bob/cool2');
      expect(stashes.get('recent_boards')).toEqual([{id: 'bob/cool2'}, {id: 'bob/cool'}]);
      persistence.remember_access('find', 'board', 'bob/cool2');
      expect(stashes.get('recent_boards')).toEqual([{id: 'bob/cool2'}, {id: 'bob/cool'}]);
    });
  });

  describe("find_recent", function() {
    it("should look up local copies of recent boards", function() {
      var found = [];
      var stored = [];
      stub(coughDropExtras.storage, 'find', function(store, key) {
        found.push(key);
        return Ember.RSVP.resolve({raw: {id: key}});
      });
      stub(CoughDrop.store, 'push', function(obj) {
        stored.push(obj);
        return obj;
      });
      stashes.persist('recent_boards', [{id: 1}, {id: 'abc'}]);
      persistence.find_recent('board');
      var stall = false;
      setTimeout(function() { stall = true; }, 100);
      waitsFor(function() { return stall && found.length >= 2 && stored.length >= 2; });
      runs(function() {
        expect(found[0]).toEqual(1);
        expect(found[1]).toEqual('abc');
        expect(stored.length).toEqual(2);
        expect(stored[0].data.id).toEqual(1);
        expect(stored[1].data.id).toEqual('abc');
      });
    });
    it("should return a promise", function() {
      var res = persistence.find_recent();
      expect(res.then).not.toEqual(null);
      res.then(null, function() { });
    });
    it("should reject on anything other than boards", function() {
      var error = null;
      persistence.find_recent('image').then(null, function(err) { error = err; });
      waitsFor(function() { return error; });
      runs(function() {
        expect(error.error).toEqual("unsupported type: image");
      });
    });
  });

  describe("find_changed", function() {
    it("should call extras.find_changed", function() {
      db_wait(function() {
        var called = false;
        stub(coughDropExtras.storage, 'find_changed', function() {
          called = true;
        });
        persistence.find_changed();
        expect(called).toEqual(true);
      });
    });
    it("should return an empty list of db isn't initialized", function() {
      var ready = coughDropExtras.get('ready');
      coughDropExtras.set('ready', false);
      var called = false;
      stub(coughDropExtras.storage, 'find_changed', function() {
        called = true;
      });
      var list = null;
      persistence.find_changed().then(function(res) { list = res; }, function() { dbg(); });
      waitsFor(function() { return list; });
      runs(function() {
        expect(list).toEqual([]);
        expect(called).toEqual(false);
      });
      coughDropExtras.set('ready', ready);
    });
    it("should return the list of changed, added and deleted records");
  });

  describe("remove", function() {
    it("should no longer find a removed record", function() {
      db_wait(function() {
        var rnd = Math.random() + "_" + (new Date()).toString();
        var found = null, not_found = null;
        persistence.store('settings', {ok: rnd}, 'check').then(function() {
          setTimeout(function() {
            persistence.find('settings', 'check').then(function(res) {
              found = res;
              persistence.remove('settings', {}, 'check').then(function() {
                setTimeout(function() {
                  persistence.find('settings', 'check').then(function(res) {
                    not_found = res;
                  } ,function() {
                    not_found = true;
                  });
                }, 50);
              });
            });
          }, 50);
        });
        waitsFor(function() { return found && not_found; });
        runs(function() {
          expect(found.ok).toEqual(rnd);
          expect(not_found).toEqual(true);
        });
      });
    });
  });

  describe("store", function() {
    it("should store a record", function() {
      db_wait(function() {
        var rnd = Math.random() + "_" + (new Date()).toString();
        var found = null;
        persistence.store('settings', {ok: rnd}, 'check').then(function() {
          setTimeout(function() {
            persistence.find('settings', 'check').then(function(res) {
              found = res;
            });
          }, 50);
        });
        waitsFor(function() { return found; });
        runs(function() {
          expect(found.ok).toEqual(rnd);
        });
      });
    });

    it("should not reject (but log an error) on a failed storage attempt", function() {
      db_wait(function() {
        stub(coughDropExtras.storage, 'store', function(store, record, key) {
          return Ember.RSVP.reject({});
        });
        var rnd = Math.random() + "_" + (new Date()).toString();
        var found = null;
        persistence.errors = [];
        persistence.store('settings', {ok: rnd}, 'check').then(function() {
          found = true;
        });
        waitsFor(function() { return found && persistence.errors.length > 0; });
        runs(function() {
          var error = persistence.errors[0];
          expect(error.message).toEqual("Failed to store object");
          expect(error.store).toEqual("settings");
          expect(error.key).toEqual("check");
        });
      });
    });

    it("should store images and sounds for stored board records", function() {
      db_wait(function() {
        var record = {
          board: {
            id: '1234',
            key: 'tmp/bread',
            name: "my picture" + Math.random()
          },
          images: [{
            id: '2345',
            url: 'data:image/png;base64,00000' + Math.random()
          }, {
            id: '3456',
            url: 'data:image/png;base64,00001' + Math.random()
          }],
          sounds: [{
            id: '4567',
            url: 'data:audio/mp3;base64,00002' + Math.random()
          }, {
            id: '5678',
            url: 'data:audio/mp3;base64,00003' + Math.random()
          }]
        };
        var rnd = Math.random() + "_" + (new Date()).toString();
        var found = [];
        persistence.log = [];
        persistence.store('board', record);
        waitsFor(function() { return persistence.log.length === 5; });
        runs(function() {
          persistence.find('board', record.board.id).then(function(res) {
            found.push(res);
          });
          persistence.find('image', record.images[0].id).then(function(res) {
            found.push(res);
          });
          persistence.find('image', record.images[1].id).then(function(res) {
            found.push(res);
          });
          persistence.find('sound', record.sounds[0].id).then(function(res) {
            found.push(res);
          });
          persistence.find('sound', record.sounds[1].id).then(function(res) {
            found.push(res);
          });
        });
        waitsFor(function() { return found.length === 5; });
        runs(function() {
          expect(found.find(function(r) { return r.id === record.board.id; })).not.toEqual(null);
          expect(found.find(function(r) { return r.id === record.board.id; }).name).toEqual(record.board.name);
          expect(found.find(function(r) { return r.id === record.images[0].id; })).not.toEqual(null);
          expect(found.find(function(r) { return r.id === record.images[0].id; }).url).toEqual(record.images[0].url);
          expect(found.find(function(r) { return r.id === record.images[1].id; })).not.toEqual(null);
          expect(found.find(function(r) { return r.id === record.images[1].id; }).url).toEqual(record.images[1].url);
          expect(found.find(function(r) { return r.id === record.sounds[0].id; })).not.toEqual(null);
          expect(found.find(function(r) { return r.id === record.sounds[0].id; }).url).toEqual(record.sounds[0].url);
          expect(found.find(function(r) { return r.id === record.sounds[1].id; })).not.toEqual(null);
          expect(found.find(function(r) { return r.id === record.sounds[1].id; }).url).toEqual(record.sounds[1].url);
        });
      });
    });
  });
  describe("store_url", function() {
    it("should return a promise", function() {
      var res = persistence.store_url("data:bacon");
      expect(res.then).not.toEqual(null);
    });

    it("should resolve immediately on a data_uri", function() {
      var done = false;
      var res = persistence.store_url("data:bacon").then(function() {
        done = true;
      });
      waitsFor(function() { return done; });
      runs();
    });

    it("should make an API call to proxy the URL", function() {
      stub(persistence, 'ajax', function(options) {
        return Ember.RSVP.resolve({
          content_type: 'image/png',
          data: 'data:nunya'
        });
      });
      var result = null;
      db_wait(function() {
        persistence.store_url("http://www.example.com/pic.png", 'image').then(function(res) {
          result = res;
        });
        waitsFor(function() { return result; });
        runs(function() {
          expect(result.url).toEqual("http://www.example.com/pic.png");
          expect(result.type).toEqual("image");
          expect(result.content_type).toEqual("image/png");
          expect(result.data_uri).toEqual("data:nunya");
        });
      });
    });

    it("should store the API results in the dataCache table", function() {
      db_wait(function() {
        stub(persistence, 'ajax', function(options) {
          return Ember.RSVP.resolve({
            content_type: 'image/png',
            data: 'data:nunya'
          });
        });
        var result = null;
        var record = null;
        persistence.stores = [];
        persistence.store_url("http://www.example.com/pic.png", 'image').then(function(res) {
          result = res;
        });
        waitsFor(function() { return result && persistence.stores.length > 0; });
        runs(function() {
          setTimeout(function() {
            persistence.find('dataCache', 'http://www.example.com/pic.png').then(function(res) {
              record = res;
            });
          }, 10);
        });
        waitsFor(function() { return record; });
        runs();
      });
    });

    it("should error on a failed API call", function() {
      db_wait(function() {
        stub(persistence, 'ajax', function(options) {
          return Ember.RSVP.reject({error: "bacon"});
        });
        var result = null;
        persistence.store_url("http://www.example.com/pic.png", 'image').then(function() { dbg(); }, function(res) {
          result = res;
        });
        waitsFor(function() { return result; });
        runs(function() {
          expect(result.error).toEqual('URL lookup failed during proxy');
        });
      });
    });
    it("should error on a failed data storage", function() {
      stub(persistence, 'ajax', function(options) {
        return Ember.RSVP.resolve({
          content_type: 'image/png',
          data: 'data:nunya'
        });
      });
      stub(persistence, 'store', function() {
        return Ember.RSVP.reject({error: "no no"});
      });
      var result = null;
      persistence.store_url("http://www.example.com/pic.png", 'image').then(null, function(res) {
        result = res;
      });
      waitsFor(function() { return result; });
      runs(function() {
        expect(result.error).toEqual("saving to data cache failed");
      });
    });
  });

  describe("temporary_id", function() {
    it("should generate a valid unique id", function() {
      var a = persistence.temporary_id();
      expect(a).not.toEqual(null);
      expect(!!a.match(/^tmp_/)).toEqual(true);
      var b = persistence.temporary_id();
      var c = persistence.temporary_id();
      expect(a).not.toEqual(b);
      expect(a).not.toEqual(c);
      expect(b).not.toEqual(c);
    });
  });
  describe("convert_model_to_json", function() {
    it("should serialize a record", function() {
      var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"})._createSnapshot();
      var json = persistence.convert_model_to_json(CoughDrop.store, 'board', board);
      expect(json).not.toEqual(null);
      expect(json.board).not.toEqual(null);
      expect(!!json.board.key.match(/^tmp_.+\/cool/)).toEqual(true);
      expect(json.board.name).toEqual("My Awesome Board");
      expect(!!json.board.id.match(/^tmp_/)).toEqual(true);
    });
    it("should call mimic_server_processing if defined", function() {
      var called = false;
      var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"})._createSnapshot();
      var type = CoughDrop.store.modelFor('board');
      stub(type, 'mimic_server_processing', function(record, data) {
        called = true;
        data.cookie = true;
        return data;
      });
      var json = persistence.convert_model_to_json(CoughDrop.store, 'board', board);
      expect(json).not.toEqual(null);
      expect(json.board).not.toEqual(null);
      expect(json.board.key).toEqual('ok/cool');
      expect(json.board.name).toEqual("My Awesome Board");
      expect(json.cookie).toEqual(true);
      expect(!!json.board.id.match(/^tmp_/)).toEqual(true);
    });
  });

  describe("offline_reject", function() {
    it("should return a promise", function() {
      var promise = persistence.offline_reject();
      expect(promise.then).not.toEqual(null);
      var res = null;
      promise.then(function() {
        res = {};
      }, function(err) {
        res = err;
      });
      waitsFor(function() { return res; });
      runs(function() {
        expect(res.error).toEqual("not online");
        expect(res.offline).toEqual(true);
      });
    });
  });

  describe("ajax", function() {
    it("should resolve on 200 response", function() {
      stub(Ember.$, 'realAjax', function(options) {
        return Ember.RSVP.resolve({});
      });
      var resolved = false;
      persistence.ajax({}).then(function() {
        resolved = true;
      }, function() {
      });
      waitsFor(function() { return resolved; });
      runs();
    });
    it("should reject on non-2xx response", function() {
      stub(Ember.$, 'realAjax', function(options) {
        return Ember.RSVP.reject({status: 300});
      });
      var rejected = false;
      persistence.ajax({}).then(function() {
      }, function(err) {
        rejected = true;
      });
      waitsFor(function() { return rejected; });
      runs();
    });
    it("should reject on 200 response with error and status attributes", function() {
      stub(Ember.$, 'realAjax', function(options) {
        return Ember.RSVP.reject({error: "bad things", status: 400});
      });
      var rejected = false;
      persistence.ajax({}).then(function() {
      }, function() {
        rejected = true;
      });
      waitsFor(function() { return rejected; });
      runs();
    });
  });

  describe("connecting (onLine)", function() {
    it("should be online by default", function() {
      expect(persistence.get('online')).toEqual(true);
    });
    it("should call sync when changing to online", function() {
      CoughDrop.sync_testing = true;
      var online = persistence.get('online');
      var called = false;
      stub(persistence, 'sync', function() {
        called = true;
        return Ember.RSVP.resolve();
      });
      persistence.set('online', false);
      expect(called).toEqual(false);
      persistence.set('online', true);
      waitsFor(function() { return called; });
      runs();
      persistence.set('online', online);
      CoughDrop.sync_testing = false;
    });
//     it("should set to offline on event", function() {
//       var online = persistence.get('online');
//       Ember.$(document).trigger('offline');
//       expect(persistence.get('online')).toEqual(false);
//       persistence.set('online', online);
//     });
//     it("should set to online on event", function() {
//       var online = persistence.get('online');
//       Ember.$(document).trigger('offline');
//       expect(persistence.get('online')).toEqual(false);
//       Ember.$(document).trigger('online');
//       expect(persistence.get('online')).toEqual(true);
//       persistence.set('online', online);
//     });
  });

  describe("DSAdapter", function() {
    describe("find", function() {
      it("should return a promise", function() {
        var res = CoughDrop.store.find('board', '1234');
        expect(res.then).not.toEqual(null);
      });
      it("should make an ajax query and find the record", function() {
        var promise = Ember.RSVP.resolve({board: {
          id: '987',
          name: 'Cool Board'
        }});
        queryLog.defineFixture({
          method: 'GET',
          type: 'board',
          response: promise,
          id: "987"
        });
        var result = null;
        CoughDrop.store.find('board', '987').then(function(res) {
          result = res;
        });
        waitsFor(function() { return result; });
        runs(function() {
          expect(result.get('name')).toEqual('Cool Board');
        });
      });
      it("should persist the record to the local db", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          stub(Ember.$, 'realAjax', function(options) {
            if(options.url === '/api/v1/boards/9876') {
              return Ember.RSVP.resolve({board: {
                id: '9876',
                name: 'Cool Board'
              }});
            } else {
              return Ember.RSVP.reject({});
            }
          });
          var local = null;
          stub(persistence, 'store_eventually', function(store, obj) {
            local = obj;
            return Ember.RSVP.resolve(obj);
          });

          var result = null;
          CoughDrop.store.find('board', '9876').then(function(res) {
            result = res;
          });
          waitsFor(function() { return result; });
          runs(function() {
            expect(local).not.toEqual(null);
            expect(local.board.name).toEqual("Cool Board");
          });
        });
      });

      it("should skip straight to a db lookup when offline", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var ajax_called = null;
          stub(Ember.$, 'realAjax', function(options) {
            ajax_called = true;
            return Ember.RSVP.reject({});
          });
          stub(persistence, 'find', function(store, key) {
            return Ember.RSVP.resolve({board: {
                id: '9876',
                name: 'Cool Board'
            }});
          });

          var result = null;
          CoughDrop.store.find('board', '9876').then(function(res) {
            result = res;
          });
          waitsFor(function() { return result; });
          runs(function() {
            expect(ajax_called).toEqual(null);
            expect(result.get('id')).toEqual('9876');
            expect(result.get('name')).toEqual('Cool Board');
          });
        });
      });

      it("should skip straight to a db lookup when finding a local id", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          var ajax_called = null;
          stub(Ember.$, 'realAjax', function(options) {
            ajax_called = true;
            return Ember.RSVP.reject({});
          });
          stub(persistence, 'find', function(store, key) {
            return Ember.RSVP.resolve({board: {
                id: 'tmp_abcd',
                name: 'Cool Board'
            }});
          });

          var result = null;
          CoughDrop.store.find('board', 'tmp_abcd').then(function(res) {
            result = res;
          });
          waitsFor(function() { return result; });
          runs(function() {
            expect(ajax_called).toEqual(null);
            expect(result.get('id')).toEqual('tmp_abcd');
            expect(result.get('name')).toEqual('Cool Board');
          });
        });
      });

      it("should reject if offline and not found in the local db", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var ajax_called = null;
          stub(Ember.$, 'realAjax', function(options) {
            ajax_called = true;
            return Ember.RSVP.reject({});
          });
          stub(persistence, 'find', function(store, key) {
            return Ember.RSVP.reject({});
          });

          var result = null;
          CoughDrop.store.find('board', '8765').then(null, function(res) {
            result = res;
          });
          waitsFor(function() { return result; });
          runs(function() {
            expect(ajax_called).toEqual(null);
            expect(result.error).toEqual("not online");
          });
        });
      });

      it("should find a locally-created record while offline", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var record = null;
          var found_record = null;

          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function(res) {
            record = res;
          });

          waitsFor(function() { return record; });
          runs(function() {
            setTimeout(function() {
              persistence.find('board', record.id).then(function(res) {
                found_record = res;
              });
            }, 50);
          });
          waitsFor(function() { return found_record; });
          runs();
        });
      });
    });

    describe("createRecord", function() {
      it("should make an ajax call if online", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          stub(Ember.$, 'realAjax', function(options) {
            return Ember.RSVP.reject({});
          });
          var result = null;
          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function() { dbg(); }, function(res) {
            result = true;
          });
          waitsFor(function() { return result; });
          runs();
        });
      });

      it("should persist to the local db if successfully created online", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          var rnd = Math.random().toString();
          stub(Ember.$, 'realAjax', function(options) {
            return Ember.RSVP.resolve({
              board: {id: '1', key: 'ok/cool', name: "My Awesome Board" + rnd}
            });
          });
          var result = null;
          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          persistence.log = [];
          board.save().then(function(res) {
            result = res;
          });
          waitsFor(function() { return result && persistence.log.length > 0; });
          var raw = null;
          runs(function() {
            setTimeout(function() {
              expect(result.get('name')).toEqual("My Awesome Board" + rnd);
              coughDropExtras.storage.find('board', 'ok/cool').then(function(res) {
                raw = res;
              });
            }, 10);
          });
          waitsFor(function() { return raw; });
          runs(function() {
            var record = raw.raw;
            expect(raw.changed).toEqual(false);
            expect(record.id).toEqual('1');
            expect(record.name).toEqual("My Awesome Board" + rnd);
          });
        });
      });

      it("should store a version locally if offline", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var record = null;
          var found_record = null;

          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function(res) {
            record = res;
          });

          waitsFor(function() { return record; });
          runs(function() {
            setTimeout(function() {
              persistence.find('board', record.id).then(function(res) {
                found_record = res;
              });
            }, 50);
          });
          waitsFor(function() { return found_record; });
          runs(function() {
            expect(!!found_record.id.match(/^tmp_/)).toEqual(true);
            expect(!!found_record.key.match(/^tmp_.+\/cool/)).toEqual(true);
            expect(found_record.name).toEqual("My Awesome Board");
          });
        });
      });

      it("should mark a locally-created record as changed for later sync", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var record = null;
          var found_record = null;

          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function(res) {
            record = res;
          });

          var raw = null;
          waitsFor(function() { return record; });
          runs(function() {
            expect(!!record.get('key').match(/^tmp_.+\/cool/)).toEqual(true);
            setTimeout(function() {
              coughDropExtras.storage.find('board', record.get('key')).then(function(res) {
                raw = res;
              });
            }, 50);
          });
          waitsFor(function() { return raw; });
          runs(function() {
            expect(raw.changed).toEqual(true);
          });
        });
      });

      it("should store an image uploaded locally if offline", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var obj = Ember.Object.create({
          });
          var controller = Ember.Object.extend({
            send: function(message) {
              this.sentMessages[message] = arguments;
            },
            model: Ember.Object.create({id: '456'})
          }).create({
            'currentUser': Ember.Object.create({user_name: 'bob', profile_url: 'http://www.bob.com/bob'}),
            sentMessages: {},
            licenseOptions: [],
            'board': {model: obj}
          });
          var button = Ember.Object.extend({
            findContentLocally: function() {
              this.foundContentLocally = true;
              return Ember.RSVP.resolve(true);
            }
          }).create();
          pictureGrabber.setup(button, controller);
          controller.set('image_preview', {url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=='});
          var button_set = false;
          stub(editManager, 'change_button', function(id, args) {
            if(id === '456' && args.image_id === '123') { button_set = true; }
          });
          pictureGrabber.select_image_preview();

          var record = null;
          waitsFor(function() { return controller.get('model.image'); });
          runs(function() {
            expect(!!controller.get('model.image.id').match(/^tmp_/)).toEqual(true);
            expect(controller.get('model.image.url')).toEqual('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==');
            expect(controller.get('image_preview')).toEqual(null);
            setTimeout(function() {
              persistence.find('image', controller.get('model.image.id')).then(function(res) {
                record = res;
              });
            }, 50);
          });
          waitsFor(function() { return record; });
          runs(function() {
            expect(!!record.id.match(/^tmp_/)).toEqual(true);
            expect(record.url).toEqual('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==');
          });
        });
      });
    });

    describe("updateRecord", function() {
      it("should make an ajax call if online", function() {
        push_board(function() {
          queryLog.real_lookup = true;
          stub(Ember.$, 'realAjax', function(options) {
            return Ember.RSVP.reject({});
          });
          var result = null;
          board.set('name', 'Cool Board');
          board.save().then(function() { dbg(); }, function(res) {
            result = true;
          });
          waitsFor(function() { return result; });
          runs();
        });
      });

      it("should persist an updated record to the local db", function() {
        push_board(function() {
          queryLog.real_lookup = true;
          stub(Ember.$, 'realAjax', function(options) {
            return Ember.RSVP.resolve({ board: {
              id: '1234',
              name: 'Righteous Board'
            }});
          });
          var result = null;
          board.set('name', 'Cool Board');
          board.save().then(function(res) {
            result = res;
          }, function(res) { dbg(); });

          var record = null;
          waitsFor(function() { return result; });
          runs(function() {
            setTimeout(function() {
              persistence.find('board', '1234').then(function(res) {
                record = res;
              });
            }, 50);
          });
          waitsFor(function() { return record; });
          runs(function() {
            expect(record.name).toEqual("Righteous Board");
          });
        });
      });

      it("should update a locally-created record that hasn't been persisted yet", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var record = null;
          var final_record = null;

          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function(res) {
            record = res;
          });

          waitsFor(function() { return record; });
          runs(function() {
            expect(!!record.get('id').match(/^tmp_/)).toEqual(true);
            expect(!!record.get('key').match(/^tmp_.+\/cool/)).toEqual(true);
            expect(record.get('name')).toEqual("My Awesome Board");
            Ember.run.later(function() {
              record.set('name', 'My Gnarly Board');
              record.save().then(function(res) {
                expect(res.id).toEqual(record.id);
                setTimeout(function() {
                  persistence.find('board', record.id).then(function(res) {
                    final_record = res;
                  }, function() { dbg(); });
                }, 50);
              }, function() { dbg(); });
            }, 50);
          });
          waitsFor(function() { return final_record; });
          runs(function() {
            expect(final_record.id).toEqual(record.id);
            expect(final_record.name).toEqual("My Gnarly Board");
          });
        });
      });

      it("should mark a locally-updated record as changed for later sync", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var record = null;
          var final_record = null;

          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function(res) {
            record = res;
          });

          waitsFor(function() { return record; });
          runs(function() {
            expect(!!record.get('id').match(/^tmp_/)).toEqual(true);
            expect(!!record.get('key').match(/^tmp_.+\/cool/)).toEqual(true);
            expect(record.get('name')).toEqual("My Awesome Board");
            Ember.run.later(function() {
              record.set('name', 'My Gnarly Board');
              record.save().then(function(res) {
                setTimeout(function() {
                  coughDropExtras.storage.find('board', record.id).then(function(res) {
                    final_record = res;
                  });
                }, 50);
              }, function() { dbg(); });
            }, 50);
          });
          waitsFor(function() { return final_record; });
          runs(function() {
            expect(final_record.changed).toEqual(true);
            expect(final_record.id).toEqual(record.id);
            expect(final_record.raw.name).toEqual("My Gnarly Board");
          });
        });
      });

      it("should ajax-create a locally-created record if updating and now online", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var record = null;
          var final_record = null;

          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function(res) {
            record = res;
          });
          stub(Ember.$, 'realAjax', function(options) {
            if(options.type === 'POST' && options.url === "/api/v1/boards") {
              if(options.data.board.name === "My Gnarly Board") {
                return Ember.RSVP.resolve({ board: {
                  id: '1234',
                  name: 'Righteous Board'
                }});
              }
            }
            return Ember.RSVP.reject({});
          });

          waitsFor(function() { return record; });
          runs(function() {
            expect(!!record.get('id').match(/^tmp_/)).toEqual(true);
            expect(!!record.get('key').match(/^tmp_.+\/cool/)).toEqual(true);
            expect(record.get('name')).toEqual("My Awesome Board");
            var tmp_id = record.get('id');
            Ember.run.later(function() {
              persistence.set('online', true);
              record.set('name', 'My Gnarly Board');
              record.save().then(function(res) {
                setTimeout(function() {
                  persistence.find('board', res.id).then(function(res) {
                    final_record = res;
                  }, function() { dbg(); });
                }, 50);
              }, function() { dbg(); });
            }, 50);
          });
          waitsFor(function() { return final_record; });
          runs(function() {
            expect(final_record.id).toEqual('1234');
            expect(final_record.name).toEqual("Righteous Board");
          });
        });
      });
      it("should ajax-update a remotely-created, locally-updated record if updating and now online", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          var record = null;
          var updated_record = null;
          var final_record = null;

          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function(res) {
            record = res;
          });
          stub(Ember.$, 'realAjax', function(options) {
            if(options.type === 'POST' && options.url === "/api/v1/boards") {
              if(options.data.board.name === "My Awesome Board") {
                return Ember.RSVP.resolve({ board: {
                  id: '1234',
                  name: 'Righteous Board'
                }});
              }
            } else if(options.type === 'PUT' && options.url === "/api/v1/boards/1234") {
              if(options.data.board.name === "Super Board") {
                return Ember.RSVP.resolve({ board: {
                  id: '1234',
                  name: 'Stellar Board'
                }});
              }
            }
            return Ember.RSVP.reject({});
          });

          waitsFor(function() { return record; });
          runs(function() {
            Ember.run.later(function() {
              expect(record.get('id')).toEqual("1234");
              expect(record.get('name')).toEqual("Righteous Board");
              persistence.set('online', false);
              record.set('name', 'My Gnarly Board');
              record.save().then(function(res) {
                updated_record = res;
              }, function() { dbg(); });
            }, 10);
          });
          waitsFor(function() { return updated_record; });
          runs(function() {
            Ember.run(function() {
              expect(updated_record.get('id')).toEqual("1234");
              expect(updated_record.get('name')).toEqual("My Gnarly Board");
              persistence.set('online', true);
              updated_record.set('name', 'Super Board');
              updated_record.save().then(function(res) {
                final_record = res;
              });
            });
          });
          waitsFor(function() { return final_record; });
          runs(function() {
            expect(final_record.get('id')).toEqual('1234');
            expect(final_record.get('name')).toEqual("Stellar Board");
          });
        });
      });

      it("should delete the temporary record once successfully persisted to the server", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var record = null;
          var final_record = null;
          var deleted_record = null;

          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function(res) {
            record = res;
          });
          stub(Ember.$, 'realAjax', function(options) {
            if(options.type === 'POST' && options.url === "/api/v1/boards") {
              if(options.data.board.name === "My Gnarly Board") {
                return Ember.RSVP.resolve({ board: {
                  id: '1234',
                  name: 'Righteous Board'
                }});
              }
            }
            return Ember.RSVP.reject({});
          });
          persistence.removals = [];
          var tmp_id = null;
          var tmp_key = null;
          waitsFor(function() { return record; });
          runs(function() {
            expect(!!record.get('id').match(/^tmp_/)).toEqual(true);
            tmp_key = record.get('key');
            tmp_id = record.get('id');
            expect(!!record.get('key').match(/^tmp_.+\/cool/)).toEqual(true);
            expect(record.get('name')).toEqual("My Awesome Board");
            Ember.run.later(function() {
              persistence.set('online', true);
              record.set('name', 'My Gnarly Board');
              record.save().then(function(res) {
                expect(res.get('id')).toEqual('1234');
                expect(res.get('name')).toEqual('Righteous Board');
//                 setTimeout(function() {
//                 }, 150);
              }, function() { dbg(); });
            }, 150);
          });
          waitsFor(function() { return persistence.removals.length > 0; });
          runs(function() {
            setTimeout(function() {
              persistence.find('board', tmp_id).then(function() { dbg(); }, function() {
                deleted_record = true;
              });
              persistence.find('board', tmp_key).then(function(res) {
                final_record = res;
              });
            }, 150);
          });
          waitsFor(function() { return final_record && deleted_record; });
          runs(function() {
            expect(final_record.id).toEqual('1234');
            expect(final_record.name).toEqual("Righteous Board");
          });
        });
      });

      it("should still allow finding by the temporary board key after persisted remotely", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var record = null;
          var final_record = null;
          var deleted_record = null;

          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function(res) {
            record = res;
          });
          stub(Ember.$, 'realAjax', function(options) {
            if(options.type === 'POST' && options.url === "/api/v1/boards") {
              if(options.data.board.name === "My Gnarly Board") {
                return Ember.RSVP.resolve({ board: {
                  id: '1234',
                  name: 'Righteous Board'
                }});
              }
            }
            return Ember.RSVP.reject({});
          });

          waitsFor(function() { return record; });
          var tmp_id = null;
          persistence.removals = [];
          runs(function() {
            expect(!!record.get('id').match(/^tmp_/)).toEqual(true);
            var tmp_key = record.get('key');
            tmp_id = record.get('id');
            expect(!!record.get('key').match(/^tmp_.+\/cool/)).toEqual(true);
            expect(record.get('name')).toEqual("My Awesome Board");
            Ember.run.later(function() {
              persistence.set('online', true);
              record.set('name', 'My Gnarly Board');
              record.save().then(function(res) {
                setTimeout(function() {
                  persistence.find('board', tmp_key).then(function(res) {
                    final_record = res;
                  });
                }, 500);
              }, function() { dbg(); });
            }, 150);
          });
          waitsFor(function() { return persistence.removals.length > 0; });
          runs(function() {
            setTimeout(function() {
              if(capabilities.dbman.repo.board.length === 2) { dbg(); }
              persistence.find('board', tmp_id).then(function() { dbg(); }, function() {
                deleted_record = true;
              });
            }, 150);
          });
          waitsFor(function() { return final_record && deleted_record; });
          runs(function() {
            expect(final_record.id).toEqual('1234');
            expect(final_record.name).toEqual("Righteous Board");
          });
        });
      });
    });

    describe("deleteRecord", function() {
      it("should make an ajax call if online", function() {
        push_board(function() {
          queryLog.real_lookup = true;
          var called = false;
          stub(Ember.$, 'realAjax', function(options) {
            if(options.type === 'DELETE' && options.url === '/api/v1/boards/1234') {
              called = true;
            }
            return Ember.RSVP.reject({});
          });
          var result = null;
          board.deleteRecord();
          board.save().then(function() { dbg(); }, function(res) {
            result = true;
          });
          waitsFor(function() { return result && called; });
          runs();
        });
      });

      it("should remove from the local db if successfully deleted", function() {
        push_board(function() {
          queryLog.real_lookup = true;
          var called = false;
          stub(Ember.$, 'realAjax', function(options) {
            if(options.type === 'DELETE' && options.url === '/api/v1/boards/1234') {
              called = true;
            }
            return Ember.RSVP.resolve({board: {id: '1234'}});
          });
          var deleted = null;
          persistence.removals = [];
          board.deleteRecord();
          board.save().then(function(res) {
          }, function() { dbg(); });
          waitsFor(function() { return persistence.removals.length > 0; });
          runs(function() {
            setTimeout(function() {
              persistence.find('board', '1234').then(function() { dbg(); }, function() {
                deleted = true;
              });
            }, 10);
          });
          waitsFor(function() { return deleted && called; });
          runs();
        });
      });

      it("should delete a locally-created record", function() {
        db_wait(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var record = null;
          var deleted = null;

          persistence.removals = [];
          var board = CoughDrop.store.createRecord('board', {key: 'ok/cool', name: "My Awesome Board"});
          board.save().then(function(res) {
            record = res;
          });

          var record_id = null;
          waitsFor(function() { return record; });
          runs(function() {
            expect(!!record.get('id').match(/^tmp_/)).toEqual(true);
            expect(!!record.get('key').match(/^tmp_.+\/cool/)).toEqual(true);
            expect(record.get('name')).toEqual("My Awesome Board");
            Ember.run.later(function() {
              record_id = record.id;
              record.deleteRecord();
              record.save().then(function(res) {
              }, function() { dbg(); });
            }, 50);
          });
          waitsFor(function() { return persistence.removals.length > 0; });
          runs(function() {
            persistence.find('board', record_id).then(function(res) {
            }, function() { deleted = true; });
          });
          waitsFor(function() { return deleted; });
          runs();
        });
      });

      it("should delete from the local db and remember the delete if offline for later sync", function() {
        push_board(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var deleted = null;
          persistence.removals = [];
          board.deleteRecord();
          board.save().then(function(res) {
            Ember.run.later(function() {
              persistence.find('board', '1234').then(function() { dbg(); }, function() {
                deleted = true;
              });
            }, 10);
          }, function() { dbg(); });
          var found_deletion = null;
          waitsFor(function() { return deleted && persistence.removals.length > 0; });
          runs(function() {
            Ember.run.later(function() {
              coughDropExtras.storage.find('deletion', 'board_1234').then(function() {
                found_deletion = true;
              });
            }, 10);
          });
          var marked_changed = false;
          waitsFor(function() { return found_deletion; });
          runs(function() {
            persistence.find_changed().then(function(list) {
              marked_changed = list.find(function(i) { return i.store === 'deletion' && i.data.storageId === 'board_1234'; });
            }, function(err) { dbg(); });
          });
          waitsFor(function() { return marked_changed; });
          runs();
        });
      });

      it("should delete from the server when sync is finally called", function() {
        push_board(function() {
          queryLog.real_lookup = true;
          persistence.set('online', false);
          var deleted = null;
          persistence.removals = [];
          board.deleteRecord();
          board.save().then(function(res) {
          }, function() { dbg(); });
          waitsFor(function() { return persistence.removals.length > 0; });
          runs(function() {
            setTimeout(function() {
              persistence.find('board', '1234').then(function() { dbg(); }, function() {
                deleted = true;
              });
            }, 50);
          });
          var found_deletion = null;
          waitsFor(function() { return deleted && persistence.removals.length > 0; });
          runs(function() {
            setTimeout(function() {
              coughDropExtras.storage.find('deletion', 'board_1234').then(function() {
                found_deletion = true;
              });
            }, 50);
          });

          var remotely_deleted = false;
          stub(Ember.$, 'realAjax', function(options) {
            if(options.url === '/api/v1/users/1256') {
              return Ember.RSVP.resolve({user: {
                id: '1256',
                user_name: 'fred'
              }});
            } else if(options.url === '/api/v1/boards/1234') {
              if(options.type === 'GET') {
                return Ember.RSVP.resolve({board: {
                  id: '1234',
                  key: 'fred/cool'
                }});
              } else if(options.type === 'DELETE') {
                remotely_deleted = true;
                return Ember.RSVP.resolve({board: {id: '1234'}});
              }
            }
            return Ember.RSVP.reject({});
          });
          waitsFor(function() { return found_deletion; });

          runs(function() {
            Ember.run.later(function() {
              persistence.set('online', true);
              persistence.sync(1256).then(null, function() { });
            }, 50);
          });
          waitsFor(function() { return remotely_deleted; });
          runs();
        });
      });
    });

    describe("findAll", function() {
    });
//   findAll: function(store, type, id) {
//     dbg()
//   },
    describe("findQuery", function() {
      it("should make an ajax call if online", function() {
        queryLog.real_lookup = true;

        var done = false;
        stub(Ember.$, 'realAjax', function(options) {
          return Ember.RSVP.resolve({board: [
            {id: '134'}
          ]});
        });
        CoughDrop.store.find('board', {user_id: 'example', starred: true, public: true}).then(function(res) {
          done = res.content && res.content[0] && res.content[0].id === '134';
        }, function() {
          dbg();
        });
        waitsFor(function() { return done; });
        runs();
      });
      it("should handle a failed ajax call if online", function() {
        queryLog.real_lookup = true;

        var done = false;
        stub(Ember.$, 'realAjax', function(options) {
          return Ember.RSVP.reject({});
        });
        CoughDrop.store.find('board', {user_id: 'example', starred: true, public: true}).then(function(res) {
          dbg();
        }, function() {
          done = true;
        });
        waitsFor(function() { return done; });
        runs();
      });

      it("should reject if offline", function() {
        queryLog.real_lookup = true;
        persistence.set('online', false);

        var ajaxed = false;
        var rejected = false;
        stub(Ember.$, 'realAjax', function(options) {
          ajaxed = true;
        });
        var done;
        CoughDrop.store.find('board', {user_id: 'example', starred: true, public: true}).then(function(res) {
          done = res.content && res.content[0] && res.content[0].id === '134';
        }, function() {
          rejected = true;
        });
        waitsFor(function() { return rejected && !ajaxed; });
        runs();
      });
    });
  });

});

