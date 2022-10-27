import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    var model = this.modelFor('organization');
    return model;
  },
  setupController: function(controller, model) {
    controller.set('model', model);
    controller.refresh_units();
    model.load_users();
  }
});
