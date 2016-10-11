import Ember from 'ember';
import persistence from '../../utils/persistence';

export default Ember.Route.extend({
  setupController: function(controller, model) {
    var _this = this;
    controller.load_goals();
  }
});
