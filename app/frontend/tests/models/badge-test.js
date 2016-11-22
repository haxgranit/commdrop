import DS from 'ember-data';
import Ember from 'ember';
import { test, moduleForModel } from 'ember-qunit';
import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
import { queryLog } from 'frontend/tests/helpers/ember_helper';
import CoughDrop from '../../app';
import persistence from '../../utils/persistence';
import modal from '../../utils/modal';
import Button from '../../utils/button';

describe('Board', function() {
  describe('progress_out_of_100', function() {
    it('should return correct values', function() {
      var b = CoughDrop.store.createRecord('badge');
      expect(b.get('progress_out_of_100')).toEqual(0);
      b.set('progress', 0.54);
      expect(b.get('progress_out_of_100')).toEqual(54);
      b.set('progress', 0.701);
      expect(b.get('progress_out_of_100')).toEqual(70.1);
    });
  });

  describe('progress_style', function() {
    it('should return correct values', function() {
      var b = CoughDrop.store.createRecord('badge');
      expect(b.get('progress_style')).toEqual('width: 0%');
      b.set('progress', 0.5);
      expect(b.get('progress_style')).toEqual('width: 50%');
      b.set('progress', -1);
      expect(b.get('progress_style')).toEqual('width: 0%');
      b.set('progress', 1.5);
      expect(b.get('progress_style')).toEqual('width: 100%');
    });
  });
});
