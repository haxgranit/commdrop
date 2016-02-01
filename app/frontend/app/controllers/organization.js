import Ember from 'ember';
import modal from '../utils/modal';
import i18n from '../utils/i18n';

export default Ember.Controller.extend({
  actions: {
    update_org: function() {
      var org = this.get('model');
      org.save().then(null, function(err) {
        console.log(err);
        modal.error(i18n.t('org_update_failed', 'Organization update failed unexpectedly'));
      });
    },
    masquerade: function() {
      if(this.get('model.admin') && this.get('model.permissions.manage')) {
        var user_name = this.get('masquerade_user_name');
        var _this = this;
        this.store.findRecord('user', user_name).then(function(u) {
          var session = _this.get('session');
          var data = session.store.restore();
          data.original_user_name = data.user_name;
          data.as_user_id = user_name;
          data.user_name = user_name;
          session.store.persist(data);
          _this.transitionToRoute('index');
          location.reload();
        }, function() {
          modal.error(i18n.t('couldnt_find_user', "Couldn't retrieve user \"%{user_name}\" for masquerading", {user_name: user_name}));
        });
      }
    },
    find_user: function() {
      var q = this.get('search_user');
      var _this = this;
      if(q) {
        CoughDrop.store.query('user', {q: q}).then(function(res) {
          if(res.content.length == 0) {
            modal.warning(i18n.t('no_user_result', "No results found for \"%{q}\"", {q: q}));
          } else if(res.content.length == 1) {
            _this.transitionToRoute('user.index', res.content[0].record.get('user_name'));
          } else {
            modal.open('user-results', {list: res, q: q});
          }
        }, function() {
          modal.error(i18n.t('error_searching', "There was an unexpected error while search for the user"));
        });
      }
    }
  }
});