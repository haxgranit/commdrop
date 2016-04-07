import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
import { db_wait } from 'frontend/tests/helpers/ember_helper';
import capabilities from '../../utils/capabilities';
import Ember from 'ember';

describe("capabilities", function() {
  describe("volume_check", function() {
    it("should return a rejecting promise by default", function() {
      stub(window, 'plugin', null);
      var done = false;
      capabilities.volume_check().then(null, function() {
        done = true;
      });
      waitsFor(function() { return done; });
      runs();
    });

    it("should return the value passed by the plugin", function() {
      var attempts = 0;
      stub(window, 'plugin', {
        volume: {
          getVolume: function(callback) {
            attempts++;
            if(attempts == 1) {
              callback(100);
            } else {
              callback(0.5);
            }
          }
        }
      });
      var result = null;
      capabilities.volume_check().then(function(res) {
        result = res;
      });
      waitsFor(function() { return result == 100; });
      runs(function() {
        capabilities.volume_check().then(function(res) {
          result = res;
        });
      });
      waitsFor(function() { return result == 0.5; });
      runs();
    });
  });

  describe("setup_database", function() {

    it("should try flushing databases on error", function() {
      db_wait(function() {
        var db_req = { };
        var attempt = 0;
        var deleted_databases = [];
        var other = "coughDropStorage::bacon===abcdefg";
        var db_key = null;
        stub(capabilities, 'db', undefined);
        stub(capabilities.idb, 'open', function(key, revision) {
          db_key = key;
          attempt++;
          var evt = {
            attempt: attempt
          };
          Ember.run.later(function() {
            db_req.onerror(evt);
            if(attempt == 2) {
              expect(deleted_databases).toEqual([key]);
            } else if(attempt == 4) {
              expect(deleted_databases).toEqual([key, other]);
            }
          }, 10);
          return db_req;
        });
        waitsFor(function() { return attempt >= 4; });
        runs(function() {
          expect(deleted_databases).toEqual([db_key, other]);
          expect(capabilities.db_error_event.attempt >= 3).toEqual(true);
        });
        stub(capabilities.idb, 'webkitGetDatabaseNames', function() {
          var res = {};
          Ember.run.later(function() {
            res.onsuccess({
              target: {
                result: [other]
              }
            });
          }, 10);
          return res;
        });
        stub(capabilities.idb, 'deleteDatabase', function(key) {
          deleted_databases.push(key);
        });
        capabilities.setup_database();
      });
    });
  });
});
