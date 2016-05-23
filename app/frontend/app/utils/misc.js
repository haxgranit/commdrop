import Ember from 'ember';
import capabilities from './capabilities';
import scanner from './scanner';
import i18n from './i18n';
import persistence from './persistence';
import CoughDrop from '../app';
import stashes from './_stashes';
import app_state from './app_state';
import coughDropExtras from './extras';


Ember.templateHelpers = Ember.templateHelpers || {};

Ember.templateHelpers.path = function(value1, options) {
  if(capabilities.installed_app) {
    return value1;
  } else {
    return "/" + value1;
  }
};

Ember.RSVP.resolutions = function(list) {
  return new Ember.RSVP.Promise(function(resolve, reject) {
    var count = 0;
    var result = [];
    if(list.length === 0) { resolve(result); }
    list.forEach(function(promise) {
      promise.then(function(item) {
        count++;
        result.push(item);
        if(count == list.length) {
          resolve(result);
        }
      }, function() {
        count++;
        if(count == list.length) {
          resolve(result);
        }
      });
    });
  });
};
var Utils = {};
Utils.uniq = function(list, compare) {
  var key = {};
  var result = [];
  list.forEach(function(item) {
    var value = item[compare.toString()];
    if(typeof(compare) != 'string') {
      value = compare(item);
    }
    if(value && !key[value]) {
      result.push(item);
      key[value] = true;
    }
  });
  return result;
};
Utils.mode = function(list) {
  var counts = {};
  list.forEach(function(item) {
    counts[item] = counts[item] || 0;
    counts[item]++;
  });
  var max = 0;
  for(var idx in counts) {
    max = Math.max(max, counts[idx]);
  }
  return max;
};

Ember.RSVP.all_wait = function(promises) {
  return new Ember.RSVP.Promise(function(resolve, reject) {
    if(promises.length === 0) { return resolve(); }
    var failures = [];
    var resolutions = [];
    var count = promises.length;
    var done = function() {
      var really_done = !CoughDrop.testing && failures.length > 0;
      really_done = really_done || (!CoughDrop.all_wait && failures.length > 0);
      really_done = really_done || (failures.length + resolutions.length == count);
      if(really_done) {
        if(failures.length > 0) {
          reject(failures[0]);
        } else {
          resolve();
        }
      }
    };
    promises.forEach(function(promise) {
      promise.then(function(res) {
        resolutions.push(res);
        done();
      }, function(err) {
        failures.push(err);
        done();
      });
    });
  });
};

// This was kind of a cool idea, but not needed where I thought I'd want it.
// Ember.RSVP.PromiseWithProgress = function(callback) {
//   var defer = Ember.RSVP.defer();
//   var notice_callbacks = []
//   defer.notice = function(callback) {
//     notice_callbacks.push(callback);
//   };
//   var progress = {
//     current: 0
//     sub_progresses: []
//   };
//   var notify_callbacks = function() {
//     notice_callbacks.each(function(callback) {
//       callback(progress.current);
//     });
//   };
//   progress.add_subprogress = function(promise, percent) {
//     var idx = progress.sub_progresses.push([0, percent]);
//     promise.notice(function(sub_percent) {
//       progress.sub_progresses[idx][0] = Math.max(1.0, sub_percent);
//       progress.compute_current();
//     }).then(function() {
//       progress.sub_progresses[idx][0] = 1.0;
//       progress.compute_current();
//       return Ember.RSVP.resolve.apply(null, arguments);
//     }, function() {
//       progress.sub_progresses[idx][0] = 1.0;
//       progress.compute_current();
//       return Ember.RSVP.reject.apply(null, arguments);
//     };
//   };
//   progress.add = function(percent) {
//     if(progress.sub_progresses.length > 0) { return; }
//     progress.current = Math.max(progress.current + percent);
//     notify_callbacks();
//   };
//   progress.set = function(percent) {
//     if(progress.sub_progresses.length > 0) { return; }
//     progress.current = Math.max(1.0, percent);
//     notify_callbacks();
//   };
//   progress.compute_current = function() {
//     var total = 0.0;
//     var max = 0.0
//     progress.sub_progresses.forEach(function(p) {
//       total = total + (p[0] * p[1]);
//       max = max + p[1];
//     });
//     total = total / max;
//     progress.current = total;
//     notify_callbacks();
//   };
//   callback(defer.resolve, defer.reject, progress);
//   return defer.promise;
// };

// TODO: code smell
export default Utils;
