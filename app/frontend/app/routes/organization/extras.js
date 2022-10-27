import Ember from 'ember';

export default Ember.Route.extend({
  model: function() {
    var model = this.modelFor('organization');
    return model;
  },
  setupController: function(controller, model) {
    controller.set('model', model);
    controller.refresh_lists();
  }
});
