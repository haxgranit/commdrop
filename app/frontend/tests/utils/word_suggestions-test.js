import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
import { fakeRecorder, fakeMediaRecorder, fakeCanvas, queryLog, easyPromise, queue_promise } from 'frontend/tests/helpers/ember_helper';
import app_state from '../../utils/app_state';
import word_suggestions from '../../utils/word_suggestions';
import Ember from 'ember';

describe('word_suggestions', function() {
  describe("lookup", function() {
    it("should suggest words", function() {
      word_suggestions.ngrams = {
        "": [['jump', -1.5], ['friend', -1.2], ['fancy', -1.0], ['for', -2.5]]
      };
      var res = null;
      word_suggestions.lookup({word_in_progress: 'f'}).then(function(r) { res = r; });
      waitsFor(function() { return res; });
      runs(function() {
        expect(res).toEqual(['friend', 'fancy', 'for']);
      });
    });
    it("should suggest even if past a misspelling", function() {
      word_suggestions.ngrams = {
        "": [['jump', -1.5], ['friend', -1.2], ['fancy', -1.0], ['for', -2.5]]
      };
      var res = null;
      word_suggestions.lookup({word_in_progress: 'frend'}).then(function(r) { res = r; });
      waitsFor(function() { return res; });
      runs(function() {
        expect(res).toEqual(['friend', 'fancy', 'for', 'jump']);
      });
    });

    it("should not suggest swear words", function() {
      word_suggestions.ngrams = {
        "": [['fuck', -1.5], ['friend', -1.2], ['fancy', -1.0], ['for', -2.5]]
      };
      var res = null;
      word_suggestions.lookup({word_in_progress: 'f'}).then(function(r) { res = r; });
      waitsFor(function() { return res; });
      runs(function() {
        expect(res).toEqual(['friend', 'fancy', 'for']);
      });
    });
  });
});
