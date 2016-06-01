/*jshint -W079 */
import { test } from 'ember-qunit';
import { async } from 'qunit';
import Ember from 'ember';

var names = [];
var all_befores = [[]];
var all_afters = [[]];
var all_tests = [];
var current_test_id = 0;
var current_afters = [];
var waiting = {};

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
  test(name, function(assert) {
    Ember.run(function() {
      pre.forEach(function(callback) {
        callback();
      });

      var this_arg = window;
      if(lookup) { this_arg = window.Frontend.__container__.lookup(lookup); }

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
    module(name);
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
    if((typeof data === 'object') || (typeof arg === 'object')) {
      deepEqual(data, arg);
    } else {
      equal(data, arg);
    }
  };
  expectation.toBeFalsy = function() {
    var falsy = !!data;
    ok(falsy === false, data + ' should be falsey');
  };

  expectation.toNotEqual = function(arg) {
    if((typeof data === 'object') || (typeof arg === 'object')) {
      QUnit.notDeepEqual(data, arg);
    } else {
      notEqual(data, arg);
    }
  };
  expectation.toBeGreaterThan = function(arg) {
    ok(data > arg, data + ' should be greater than ' + arg);
  };
  expectation.toBeLessThan = function(arg) {
    ok(data < arg, data + ' should be less than ' + arg);
  };
  expectation.toMatch = function(regex) {
    if(typeof regex == 'string') {
      regex = new RegExp(regex);
    }
    ok(data && data.match(regex), data + ' should match ' + regex.toString());
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
        equal(message, error.message || error);
      } else {
        ok(true);
      }
    } else {
      ok(false, 'expected error, none was raised');
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
        ok(false, 'expected no error, got ' + error.message);
      } else {
        ok(true);
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
  callback = callback || function() { ok(true); };
  var id = current_test_id;
  var wait = lastWaitsFor;
  var attempts = 0;
  waiting[current_test_id] = waiting[current_test_id] || 0;
  waiting[current_test_id]++;
  QUnit.stop(); // TODO: this seems like it should be QUnit.async()
  var done = function() {
    if(id == current_test_id) {
      waiting[current_test_id]--;
      QUnit.start();
    }
  };
  var try_again = function() {
    if(wait()) {
      done();
      Ember.run(callback);
    } else if(id == current_test_id) {
      attempts++;
      if(attempts >= 55) {
        ok(false, 'condition failed for more than 5000ms');
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
  object[method] = replacement;
  //console.log(stubs);
  stub.stubs.push([object, method, stash]);
};
stub.stubs = [];


export {context, describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub};
