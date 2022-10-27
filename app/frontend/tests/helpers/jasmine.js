/*jshint -W079 */
import { test, moduleFor } from 'ember-qunit';
import { async } from 'qunit';
import testHelpers from 'ember-test-helpers';
import Ember from 'ember';

var names = [];
var all_befores = [[]];
var all_afters = [[]];
var all_tests = [];
var current_test_id = 0;
var current_afters = [];
var waiting = {};

var assert = null;
function test_wrap(name, instance, befores, afters, lookup) {
  var pre = [];
  var post = [];
  all_befores.forEach(function(list) {
    list.forEach(function(callback) {
      pre.push(callback);
    });
  });
  all_afters.forEach(function(list) {
    list.forEach(function(callback) {
      post.push(callback);
    });
  });
  current_afters = post;
  QUnit.test(name, function(current_assert) {
    assert = current_assert;
    Ember.run(function() {
      pre.forEach(function(callback) {
        callback();
      });

      var this_arg = window;

      if(lookup) {
        this_arg = new testHelpers.TestModule(lookup, name, []);
      }

      current_test_id++;
      instance.call(this_arg);

      waitsFor(function() { return waiting[current_test_id] <= 1; });
      runs(function() {
        current_afters = [];
        post.forEach(function(callback) {
          callback();
        });
      });
    });
  });
}

var container_lookup = null;
var describe = function(name, lookup, callback) {
  if(!callback) {
    callback = lookup;
  } else {
    if(names.length === 0) { container_lookup = lookup; }
  }
  if(names.length === 0) {
    QUnit.module(name);
  }
  names.push(name);
  all_tests.push([]);
  all_befores.push([]);
  all_afters.unshift([]);
  callback();
  all_tests[all_tests.length - 1].forEach(function(args) {
    if(args[1]) {
      test_wrap(names.join(" ") + " - " + args[0], args[1], all_befores, all_afters, container_lookup);
    } else {
      console.debug('PENDING TEST: ' + names.join(" ") + " - " + args[0]);
    }
  });
  names.pop();
  all_befores.pop();
  all_afters.shift();
  all_tests.pop();
};
var context = describe;
var it = function(rule, testing) {
  all_tests[all_tests.length - 1].push([rule, testing]);
};
var expect = function(data) {
  var expectation = {};
  expectation.toEqual = function(arg) {
    if((data === undefined && arg === null) || (data === null && arg === undefined)) {
      assert.ok(true, 'both empty values');
    } else if((typeof data === 'object') || (typeof arg === 'object')) {
      assert.deepEqual(data, arg);
    } else {
      assert.equal(data, arg);
    }
  };
  expectation.toBeFalsy = function() {
    var falsy = !!data;
    assert.ok(falsy === false, data + ' should be falsey');
  };

  expectation.toNotEqual = function(arg) {
    if((data === undefined && arg === null) || (data === null && arg === undefined)) {
      assert.ok(false, data + " should not equal " + arg);
    } else if((typeof data === 'object') || (typeof arg === 'object')) {
      assert.notDeepEqual(data, arg);
    } else {
      assert.notEqual(data, arg);
    }
  };
  expectation.toBeGreaterThan = function(arg) {
    assert.ok(data > arg, data + ' should be greater than ' + arg);
  };
  expectation.toBeLessThan = function(arg) {
    assert.ok(data < arg, data + ' should be less than ' + arg);
  };
  expectation.toMatch = function(regex) {
    if(typeof regex == 'string') {
      regex = new RegExp(regex);
    }
    assert.ok(data && data.match(regex), data + ' should match ' + regex.toString());
  };
  expectation.toThrow = function(message) {
    var error = null;
    try {
      data();
    } catch(e) {
      error = e;
    }
    if(error) {
      if(message) {
        assert.equal(message, error.message || error);
      } else {
        assert.ok(true);
      }
    } else {
      assert.ok(false, 'expected error, none was raised');
    }
  };
  expectation.not = {
    toEqual: expectation.toNotEqual,
    toThrow: function() {
      var error = null;
      try {
        data();
      } catch(e) {
        error = e;
      }
      if(error) {
        assert.ok(false, 'expected no error, got ' + error.message);
      } else {
        assert.ok(true);
      }
    }
  };

  return expectation;
};

var lastWaitsFor = null;
var waitsFor = function(callback) {
  lastWaitsFor = callback;
};

var runs = function(callback) {
  callback = callback || function() { assert.ok(true); };
  var id = current_test_id;
  var wait = lastWaitsFor;
  var attempts = 0;
  waiting[current_test_id] = waiting[current_test_id] || 0;
  waiting[current_test_id]++;
  var async_done = assert.async();
  var done = function() {
    if(id == current_test_id) {
      waiting[current_test_id]--;
      async_done();
    }
  };
  var try_again = function() {
    if(wait()) {
      Ember.run(callback);
      done();
    } else if(id == current_test_id) {
      attempts++;
      if(attempts >= 55) {
        assert.ok(false, 'condition failed for more than 5000ms');
        done();
      } else {
        var delay = 1;
        if(attempts  < 10) { delay = 10; }
        else if(attempts > 3) { delay = 100; }
        setTimeout(try_again, delay);
      }
    }
  };
  try_again();
};

var beforeEach = function(callback) {
  all_befores[all_befores.length - 1].push(callback);
};
var afterEach = function(callback) {
  all_afters[all_afters.length - 1].push(callback);
};

var stub = function(object, method, replacement) {
  stub.stubs = stub.stubs || [];
  var stash = object[method];
  Ember.set(object, method, replacement);
  //console.log(stubs);
  stub.stubs.push([object, method, stash]);
};
stub.stubs = [];


export {context, describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub};
