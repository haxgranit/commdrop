import Ember from 'ember';

export default Ember.Helper.helper(function(params, hash) {
  console.log(params[0]);
  return "";
});