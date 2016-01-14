import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
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
});
