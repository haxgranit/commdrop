import Ember from 'ember';

export default Ember.Helper.helper(function(params, hash) {
  return Ember.templateHelpers.time(params[0], params[1]);
});