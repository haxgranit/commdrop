import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
import { easyPromise, db_wait } from 'frontend/tests/helpers/ember_helper';
import Utils from '../../utils/misc';
import modal from '../../utils/modal';
import scanner from '../../utils/scanner';
import Ember from 'ember';

describe("misc", function() {
  describe("handlebars helpers", function() {
  });

  describe("resolutions", function() {
    it("should return the list of resolutions, if any", function() {
      var defers = [];
      var promises = [];
      for(var idx = 0; idx < 5; idx++) {
        var defer = Ember.RSVP.defer();
        defers.push(defer);
        promises.push(defer.promise);
      }
      var resolutions = null;
      Ember.RSVP.resolutions(promises).then(function(list) {
        resolutions = list;
      });

      defers[0].resolve();
      expect(resolutions).toEqual(null);

      defers[1].resolve();
      expect(resolutions).toEqual(null);

      defers[2].reject();
      expect(resolutions).toEqual(null);

      defers[3].reject();
      expect(resolutions).toEqual(null);

      defers[4].resolve();
      waitsFor(function() { return resolutions; });
      runs(function() {
        expect(resolutions.length).toEqual(3);
      });
    });
    it("should resolve immediately for an empty list of promises", function() {
      var resolved = false;
      Ember.RSVP.resolutions([]).then(function(list) {
        resolved = true;
      });
      waitsFor(function() { return resolved; });
      runs();
    });
    it("should not fail when promises reject", function() {
      var defer = Ember.RSVP.defer();
      var resolved = false;
      Ember.RSVP.resolutions([defer.promise]).then(function(list) {
        resolved = list.length === 0;
      });
      defer.reject();
      waitsFor(function() { return resolved; });
      runs();
    });
  });

  describe("Utils", function() {
    describe("uniq", function() {
      it("should uniqify based on a string attribute", function() {
        var list = [{a: 1}, {a: 1}, {a: 2}];
        var res = Utils.uniq(list, 'a');
        expect(res).toEqual([{a: 1}, {a: 2}]);
      });
      it("should ignore any results with no value for the attribute", function() {
        var list = [{a: 1}, {a: 1}, {a: 2}, {b: 1}, {b: 2}];
        var res = Utils.uniq(list, 'a');
        expect(res).toEqual([{a: 1}, {a: 2}]);
      });
      it("should uniqify based on a function attribute", function() {
        var list = [{a: 1}, {a: 1}, {b: 2}, {b: 3}];
        var res = Utils.uniq(list, function(i) { return i.b || (i.a * 2); });
        expect(res).toEqual([{a: 1}, {b: 3}]);
      });
    });

    describe("max_appearance", function() {
      it("should calculate the correct max_appearance", function() {
        expect(Utils.max_appearance([1,1,1,1,2,2,3])).toEqual(4);
        expect(Utils.max_appearance([1,2,3,1,2,3,1,2,3])).toEqual(3);
        expect(Utils.max_appearance([1,2,3,4,56,7,8,9,8])).toEqual(2);
        expect(Utils.max_appearance(['a', 'b', 'c', 'a', 'b', 'a'])).toEqual(3);
      });
    });
  });
});
