import CoughDrop from '../app';
import $ from 'jquery';
import app_state from '../utils/app_state';
import i18n from '../utils/i18n';
import modal from '../utils/modal';
import { set as emberSet } from '@ember/object';
import { computed } from '@ember/object';

export default modal.ModalController.extend({
  opening: function() {
    var board = this.get('model.board');
    this.set('model', board);
    this.set('originally_public', board.get('public'));
  },
  closing: function() {
    if(this.get('model.home_board')) {
      var cats = [];
      (this.get('board_categories') || []).forEach(function(cat) {
        if(cat.selected) {
          cats.push(cat.id);
        }
      });
      this.set('model.categories', cats);
    } else {
      this.set('model.categories', []);
    }
    if(this.get('model.intro')) {
      this.set('model.intro.unapproved', false);
    }
  },
  board_categories: computed('model.home_board', 'model.id', 'model.categories', function() {
    var res = [];
    var _this = this;
    var cats = {};
    (this.get('model.categories') || []).forEach(function(str) { cats[str] = true; });
    CoughDrop.board_categories.forEach(function(c) {
      var cat = $.extend({}, c);
      if(cats[c.id]) { cat.selected = true; }
      res.push(cat);
    });
    return res;
  }),
  locales: computed(function() {
    var list = i18n.get('locales');
    var res = [{name: i18n.t('choose_locale', '[Choose a Language]'), id: ''}];
    for(var key in list) {
      res.push({name: list[key], id: key});
    }
    res.push({name: i18n.t('unspecified', "Unspecified"), id: ''});
    return res;
  }),
  licenseOptions: CoughDrop.licenseOptions,
  public_options: CoughDrop.publicOptions,
  iconUrls: CoughDrop.iconUrls,
  attributable_license_type: computed('model.license.type', function() {
    if(!this.get('model.license')) { return; }
    if(this.get('model.license') && this.get('model.license.type') != 'private') {
      this.update_license();
    }
    return this.get('model.license.type') != 'private';
  }),
  update_license() {
    this.set('model.license.author_name', this.get('model.license.author_name') || app_state.get('currentUser.name'));
    this.set('model.license.author_url',this.get('model.license.author_url') || app_state.get('currentUser.profile_url'));
  },
  actions: {
    close: function() {
      modal.close();
    },
    pickImageUrl: function(url) {
      this.set('model.image_url', url);
    },
    add_board_intro_section: function() {
      var intro = this.get('model.intro') || {};
      emberSet(intro, 'unapproved', false);
      var sections = intro.sections || [];
      sections.pushObject({});
      emberSet(intro, 'sections', sections);
      this.set('model.intro', intro);
    },
    delete_board_intro_section: function(section) {
      if(!this.get('model.intro.sections')) { return; }
      var sections = this.get('model.intro.sections') || [];
      sections = sections.filter(function(s) { return s != section; });
      this.set('model.intro.sections', sections);
    }
  }
});
