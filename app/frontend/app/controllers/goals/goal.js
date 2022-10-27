import Ember from 'ember';
import persistence from '../../utils/persistence';
import modal from '../../utils/modal';
import i18n from '../../utils/i18n';

export default Ember.Controller.extend({
  advance_options: [
    {name: i18n.t('none', "Never"), id: "none"},
    {name: i18n.t('on_the_date', "On the Date"), id: "date"},
    {name: i18n.t('after_time', "After Time"), id: "duration"}
  ],
  advance_unit_options: [
    {name: i18n.t('months', "Months"), id: "month"},
    {name: i18n.t('weeks', "Weeks"), id: "week"},
    {name: i18n.t('days', "Days"), id: "day"}
  ],
  load_templates_for_header: function() {
    if(this.get('model.template_header')) {
      this.load_templates();
    }
  }.observes('model.template_header'),
  load_templates: function() {
    if(this.get('model.related.header.id') && this.get('templates_list_for') != this.get('model.related.header.id')) {
      var _this = this;
      _this.set('status', {loading_templates: true});
      var header_id = _this.get('model.related.header.id');
      _this.store.query('goal', {template_header_id: header_id}).then(function(list) {
        _this.set('status', null);
        var res = [{id: '', name: i18n.t('none_set', "None Set")}];
        list = list.content.mapBy('record');
        list.forEach(function(g) {
          if(!g.get('related')) { g.set('related', {}); }
          if(!g.get('related.next') && g.get('next_template_id')) {
            var next = list.find(function(r) { return r.get('id') == g.get('next_template_id'); });
            g.set('related.next', next);
          }
          if(!g.get('related.previous')) {
            var previous = list.find(function(r) { return r.get('next_template_id') == g.get('id'); });
            g.set('related.previous', previous);
          }
          if(!g.get('related.header') && g.get('template_header_id')) {
            var header = list.find(function(r) { return r.get('id') == g.get('template_header_id'); });
            g.set('related.header', header);
          }
        });
        res = res.concat(list.map(function(g) { return {id: g.get('id'), name: g.get('summary')}; }));
        res.push({id: 'new', name: i18n.t('new_template', "New Template")});
        _this.set('templates', list);
        _this.set('template_options', res);
        _this.set('templates_list_for', header_id);
      }, function(err) {
        _this.set('status', {loading_templates_error: true});
      });
    }
  },
  load_templates_when_editing: function() {
    if(this.get('editing')) {
      this.load_templates();
    }
  }.observes('editing'),
  actions: {
    save: function() {
      var goal = this.get('model');
      var _this = this;
      _this.set('status', {saving: true});
      goal.update_advancement();
      goal.generate_next_template_if_new().then(function(next_template) {
        if(next_template) {
          goal.set('next_template_id', next_template.get('id'));
        }
        return goal.save();
      }).then(function(g) {
        _this.set('status', null);
        _this.set('editing', false);
        _this.get('templates_list_for', null);
      }, function(err) {
        _this.set('status', {saving_error: true});
      });
    },
    cancel_save: function() {
      this.set('editing', false);
    },
    edit_goal: function() {
      this.set('editing', !this.get('editing'));
    },
    delete_goal: function() {
      var goal = this.get('model');
      goal.deleteRecord();
      var _this = this;
      _this.set('status', {deleting: true});
      goal.save().then(function(r) {
        _this.redirectToRoute('index');
      }, function(err) {
        _this.set('status', {delete_error: true});
      });
    },
    remove_badge: function(badge) {
      this.get('model').remove_badge(badge);
    },
    add_badge_level: function() {
      if(this.get('model')) {
        this.get('model').add_badge_level();
      }
    }
  }
});
