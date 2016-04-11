import Ember from 'ember';
import CoughDrop from '../app';
import persistence from '../utils/persistence';
import app_state from '../utils/app_state';
import session from '../utils/session';
import Utils from '../utils/misc';

export default Ember.Controller.extend({
  title: function() {
    return "Search results for " + this.get('searchString');
  }.property('searchString'),
  load_results: function(str) {
    var _this = this;
    this.set('online_results', {loading: true, results: []});
    this.set('local_results', {loading: true, results: []});

    if(session.get('isAuthenticated')) {
      persistence.find_boards(str).then(function(res) {
        _this.set('local_results', {results: res});
      }, function() { _this.set('local_results', {results: []}); });
    } else {
      _this.set('local_results', {impossible: true});
    }

    function loadBoards() {
      if(persistence.get('online')) {
        _this.set('online_results', {loading: true, results: []});
        _this.set('personal_results', {loading: true, results: []});
        CoughDrop.store.query('board', {q: str}).then(function(res) {
          _this.set('online_results', {results: res.content.mapBy('record')});
        }, function() {
          _this.set('online_results', {results: []});
        });
        if(app_state.get('currentUser')) {
          CoughDrop.store.query('board', {q: str, user_id: 'self'}).then(function(res) {
            _this.set('personal_results', {results: res.content.mapBy('record')});
          }, function() {
            _this.set('personal_results', {results: []});
          });
        } else{
          _this.set('personal_results', {results: []});
        }
      } else {
        _this.set('online_results', {results: []});
        _this.set('personal_results', {results: []});
      }
    }
    loadBoards();

    persistence.addObserver('online', function() {
      loadBoards();
    });

  }
});

