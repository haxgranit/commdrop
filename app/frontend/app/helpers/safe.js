import Ember from 'ember';

export default Ember.Helper.helper(function(params, hash) {
  return Ember.templateHelpers.safe(params[0]);
});
