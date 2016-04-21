import Ember from 'ember';
import persistence from './persistence';
import capabilities from './capabilities';

var word_suggestions = Ember.Object.extend({
  load: function() {
    var _this = this;
    if(this.ngrams) {
      return Ember.RSVP.resolve();
    } else if(capabilities.installed_app && !this.local_failed) {
      return Ember.$.ajax({
        url: 'ngrams.arpa.json',
        type: 'GET',
        dataType: 'json'
      }).then(function(data) {
        _this.ngrams = data;
        return true;
      }, function() {
        _this.local_failed = true;
//         return _this.load();
        return Ember.RSVP.reject();
      });
    } else if(this.error) {
      return Ember.RSVP.reject();
    } else if(this.loading) {
      this.watchers = this.watchers || [];
      var defer = Ember.RSVP.defer();
      this.watchers.push(defer);
      return defer.promise;
    } else {
      _this.loading = true;
      var promises = [];
      var ngrams = {};
      var previous = Ember.RSVP.resolve();
      var data_type = "json";
      // TODO: concurrent downloads can happen just fine as long as you
      // receive them as text instead of json, and call JSON.parse one
      // at a time.
      ['trimmed'].forEach(function(idx) {
        var defer = Ember.RSVP.defer();
        promises.push(defer.promise);
        previous.then(function() {
          var store_key = "arpa-." + idx + "." + _this.pieces + ".json";
          var remote_url = "https://s3.amazonaws.com/coughdrop/language/ngrams.arpa." + idx + "." + _this.pieces + ".json";
          var find_or_store = persistence.find('settings', store_key).then(null, function() {
            return Ember.$.ajax({
              url: remote_url,
              type: "GET",
              dataType: data_type
            }).then(function(res) {
              if(data_type == 'text') {
                res = JSON.parse(res.text);
              }
              res.storageId = store_key;
              return persistence.store('settings', {suggestions: res}, store_key);
            });
          });
          find_or_store.then(function(res) {
            for(var idx in res.suggestions) {
              ngrams[idx] = ngrams[idx] || [];
              ngrams[idx] = ngrams[idx].concat(res.suggestions[idx]);
            }
            Ember.run.later(function() {
              defer.resolve();
            });
          }, function() {
            defer.reject();
          });
        });
        previous = defer.promise;
      });
      var res = Ember.RSVP.all(promises).then(function() {
        _this.loading = false;
        _this.ngrams = ngrams;
        if(_this.watchers) {
          _this.watchers.forEach(function(d) {
            d.resolve();
          });
        }
        _this.watchers = null;
        return true;
      }, function() {
        _this.loading = false;
        _this.error = true;
        if(_this.watchers) {
          _this.watchers.forEach(function(d) {
            d.reject();
          });
        }
        _this.watchers = null;
        return false;
      });
      promises.forEach(function(p) { p.then(null, function() { }); });
      return res;
    }
  },
  lookup: function(options) {
    var _this = this;
    return this.load().then(function() {
      var last_finished_word = options.last_finished_word;
      var word_in_progress = options.word_in_progress;
      var result = [];
      if(_this.last_finished_word != last_finished_word || _this.word_in_progress != word_in_progress) {
        _this.last_finished_word = last_finished_word;
        _this.word_in_progress = word_in_progress;
        var find_lookups = function(list) {
          if(!list) { return; }
          for(var idx = 0; idx < list.length && result.length < _this.max_results; idx++) {
            var str = list[idx];
            if(typeof(str) != 'string') { str = str[0]; }
            if(word_in_progress) {
              if(str.substring(0, word_in_progress.length) == word_in_progress) {
                result.push(list[idx][0]);
              }
            } else if(str[0] != "<") {
              result.push(list[idx][0]);
            }
          }
          return result;
        };
        find_lookups(_this.ngrams[last_finished_word]);
        if(result.length < _this.max_results) { find_lookups(_this.ngrams['']); }
        if(result.length < _this.max_results) {
          var edits = [];
          _this.ngrams[''].forEach(function(str) {
            var dist = _this.edit_distance(word_in_progress, str[0]);
            edits.push([str[0], dist, str[1]]);
          });
          edits = edits.sort(function(a, b) {
            if(a[1] == b[1]) {
              return b[2] - a[2];
            } else {
              return a[1] - b[1];
            }
          });
          edits.forEach(function(e) {
            if(result.length < _this.max_results) {
              result.push(e[0]);
            }
          });
        }
        //if(result.length < _this.max_results) { find_lookups(Ember.keys(_this.ngrams)); }
        _this.last_result = result;
        return Ember.RSVP.resolve(result);
      } else {
        return Ember.RSVP.resolve(_this.last_result);
      }
    });
  },
  edit_distance: function(a, b) {
    // Compute the edit distance between the two given strings
    if(a.length === 0) { return b.length; }
    if(b.length === 0) { return a.length; }

    var matrix = [];

    // increment along the first column of each row
    var i;
    for(i = 0; i <= b.length; i++){
      matrix[i] = [i];
    }

    // increment each column in the first row
    var j;
    for(j = 0; j <= a.length; j++){
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for(i = 1; i <= b.length; i++){
      for(j = 1; j <= a.length; j++){
        if(b.charAt(i-1) == a.charAt(j-1)){
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                                  Math.min(matrix[i][j-1] + 1, // insertion
                                           matrix[i-1][j] + 1)); // deletion
        }
      }
    }

    return matrix[b.length][a.length];
  }
}).create({pieces: 10, max_results: 5});

export default word_suggestions;
