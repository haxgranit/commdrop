import DS from 'ember-data';
import Ember from 'ember';
import { test, moduleForModel } from 'ember-qunit';
import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
import { } from 'frontend/tests/helpers/ember_helper';
import CoughDrop from '../../app';

describe('Log', function() {
  describe("minutes", function() {
    it("should not error on empty value", function() {
      var log = CoughDrop.store.createRecord('log', {});
      expect(log.get('minutes')).toEqual(0);
    });
    it("should return filename if found in URL path, ignoring query params", function() {
      var log = CoughDrop.store.createRecord('log', {duration: 100});
      expect(log.get('minutes')).toEqual(2);
      log.set('duration', 300);
      expect(log.get('minutes')).toEqual(5);
    });
  });

  describe("goal_status_class", function() {
    it('should return the correct class', function() {
      var log = CoughDrop.store.createRecord('log');

      expect(log.get('goal_status_class')).toEqual('');

      log.set('goal', {});
      expect(log.get('goal_status_class')).toEqual('');

      log.set('goal', {status: 1});
      expect(log.get('goal_status_class')).toEqual('face sad');

      log.set('goal', {status: 2});
      expect(log.get('goal_status_class')).toEqual('face neutral');

      log.set('goal', {status: 3});
      expect(log.get('goal_status_class')).toEqual('face happy');

      log.set('goal', {status: 4});
      expect(log.get('goal_status_class')).toEqual('face laugh');

      log.set('goal', {status: 5});
      expect(log.get('goal_status_class')).toEqual('');
    });
  });

  describe("daily_use_history", function() {
    it('should have specs', function() {
      expect('test').toEqual('todo');
    });
  });
});
