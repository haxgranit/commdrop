import Ember from 'ember';
import app_state from '../utils/app_state';

export default Ember.Route.extend({
  beforeModel: function() {
    app_state.set('show_intro', true);
    this.transitionTo('index');
  }
});
