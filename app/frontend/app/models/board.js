import Ember from 'ember';
import DS from 'ember-data';
import CoughDrop from '../app';
import i18n from '../utils/i18n';
import persistence from '../utils/persistence';
import modal from '../utils/modal';

CoughDrop.Board = DS.Model.extend({
  didLoad: function() {
    this.checkForDataURL().then(null, function() { });
    this.check_for_copy();
    this.clean_license();
  },
  name: DS.attr('string'),
  key: DS.attr('string'),
  description: DS.attr('string'),
  local_result: DS.attr('boolean'),
  created: DS.attr('date'),
  updated: DS.attr('date'),
  user_name: DS.attr('string'),
  full_set_revision: DS.attr('string'),
  for_user_id: DS.attr('string'),
  could_be_in_use: function() {
    // no longer using (this.get('public') && this.get('brand_new'))
    return this.get('non_author_uses') > 0 || this.get('non_author_starred');
  }.property('non_author_uses', 'public', 'brand_new', 'stars'),
  definitely_in_use: function() {
    return this.get('non_author_uses') > 0 || this.get('stars') > 0;
  }.property('non_author_uses', 'stars'),
  fallback_image_url: "https://s3.amazonaws.com/opensymbols/libraries/arasaac/board_3.png",
  key_placeholder: function() {
    var key = (this.get('name') || "my-board").replace(/^\s+/, '').replace(/\s+$/, '');
    var ref = key;
    while(key.length < 4) {
      key = key + ref;
    }
    key = key.toLowerCase().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+$/, '').replace(/-+/g, '-');
    return key;
  }.property('name'),
  icon_url_with_fallback: function() {
    // TODO: way to fall back to something other than a broken image when disconnected
    if(persistence.get('online')) {
      return this.get('image_data_uri') || this.get('image_url') || this.fallback_image_url;
    } else {
      return this.get('image_data_uri') || this.fallback_image_url;
    }
  }.property('image_url'),
  shareable: function() {
    return this.get('public') || this.get('permissions.edit');
  }.property('public', 'permissions.edit'),
  used_buttons: function() {
    var result = [];
    var grid = this.get('grid');
    var buttons = this.get('buttons');
    if(!grid || !buttons) { return []; }
    for(var idx = 0; idx < grid.order[0].length; idx++) {
      for(var jdx = 0; jdx < grid.order.length; jdx++) {
        var id = grid.order[jdx][idx];
        if(id) {
          var button = null;
          for(var kdx = 0; kdx < buttons.length; kdx++) {
            if(buttons[kdx].id == id) {
              result.push(buttons[kdx]);
            }
          }
        }
      }
    }
    return result;
  }.property('buttons', 'grid'),
  labels: function() {
    var list = [];
    this.get('used_buttons').forEach(function(button) {
      if(button && button.label) {
        list.push(button.label);
      }
    });
    return list.join(', ');
  }.property('buttons', 'grid'),
  nothing_visible: function() {
    var found_visible = false;
    this.get('used_buttons').forEach(function(button) {
      if(button && !button.hidden) {
        found_visible = true;
      }
    });
    return !found_visible;
  }.property('buttons', 'grid'),
  local_images_with_license: function() {
    var images = CoughDrop.store.peekAll('image');
    var result = [];
    var missing = false;
    this.get('used_buttons').forEach(function(button) {
      if(button && button.image_id) {
        var image = images.findBy('id', button.image_id.toString());
        if(image) {
          result.push(image);
        } else {
          console.log('missing image ' + button.image_id);
          missing = true;
        }
      }
    });
    result = result.uniq();
    result.some_missing = missing;
    return result;
  }.property('grid', 'buttons'),
  local_sounds_with_license: function() {
    var sounds = CoughDrop.store.peekAll('sound');
    var result = [];
    var missing = false;
    this.get('used_buttons').forEach(function(button) {
      if(button && button.sound_id) {
        var sound = sounds.findBy('id', button.sound_id.toString());
        if(sound) {
          result.push(sound);
        } else {
          console.log('missing sound ' + button.sound_id);
          missing = true;
        }
      }
    });
    result = result.uniq();
    result.some_missing = missing;
    return result;
  }.property('grid', 'buttons'),
  without_lookups: function(callback) {
    this.set('no_lookups', true);
    callback();
    this.set('no_lookups', false);
  },
  set_all_ready: function() {
    var allReady = true;
    if(!this.get('pending_buttons')) { return; }
    this.get('pending_buttons').forEach(function(b) {
      if(b.get('content_status') != 'ready') { allReady = false; }
    });
    this.set('all_ready', allReady);
  }.observes('pending_buttons', 'pending_buttons.[]', 'pending_buttons.@each.content_status'),
  prefetch_linked_boards: function() {
    var boards = this.get('linked_boards');
    Ember.run.later(function() {
      boards.forEach(function(b) {
        CoughDrop.store.findRecord('board', b.key).then(null, function() { });
      });
    });
  },
  clean_license: function() {
    var _this = this;
    ['copyright_notice', 'source', 'author'].forEach(function(key) {
      if(_this.get('license.' + key + '_link')) {
        _this.set('license.' + key + '_url', _this.get('license.' + key + '_url') || _this.get('license.' + key + '_link'));
      }
      if(_this.get('license.' + key + '_link')) {
        _this.set('license.' + key + '_link', _this.get('license.' + key + '_link') || _this.get('license.' + key + '_url'));
      }
    });
  },
  linked_boards: function() {
    var buttons = this.get('buttons') || [];
    var result = [];
    for(var idx = 0; idx < buttons.length; idx++) {
      if(buttons[idx].load_board) {
        var board = buttons[idx].load_board;
        if(buttons[idx].link_disabled) {
          board.link_disabled = true;
        }
        result.push(board);
      }
    }
    return result.uniq();
  }.property('buttons'),
  unused_buttons: function() {
    var unused = [];
    var grid = this.get('grid');
    var button_ids = [];
    if(grid && grid.order) {
      for(var idx = 0; idx < grid.order.length; idx++) {
        if(grid.order[idx]) {
          for(var jdx = 0; jdx < grid.order[idx].length; jdx++) {
            button_ids.push(grid.order[idx][jdx]);
          }
        }
      }
    }
    var buttons = this.get('buttons');
    buttons.forEach(function(button) {
      if(button_ids.indexOf(button.id) == -1) {
        unused.push(button);
      }
    });
    return unused;
  }.property('buttons', 'grid', 'grid.order'),
  long_preview: function() {
    var date = Ember.templateHelpers.date(this.get('created'), 'day');
    var labels = this.get('labels');
    if(labels && labels.length > 100) {
      var new_labels = "";
      var ellipsed = false;
      labels.split(/, /).forEach(function(l) {
        if(new_labels.length === 0) {
          new_labels = l;
        } else if(new_labels.length < 75) {
          new_labels = new_labels + ", " + l;
        } else if(!ellipsed) {
          ellipsed = true;
          new_labels = new_labels + "...";
        }
      });
      labels = new_labels;
    }
    return this.get('name') + " (" + date + ") - " + this.get('user_name') + " - " + labels;
  }.property('name', 'labels', 'user_name', 'created'),
  search_string: function() {
    return this.get('name') + " " + this.get('user_name') + " " + this.get('labels');
  }.property('name', 'labels', 'user_name'),
  parent_board_id: DS.attr('string'),
  parent_board_key: DS.attr('string'),
  link: DS.attr('string'),
  image_url: DS.attr('string'),
  buttons: DS.attr('raw'),
  grid: DS.attr('raw'),
  license: DS.attr('raw'),
  images: DS.hasMany('image'),
  permissions: DS.attr('raw'),
  copy: DS.attr('raw'),
  original: DS.attr('raw'),
  word_suggestions: DS.attr('boolean'),
  public: DS.attr('boolean'),
  brand_new: DS.attr('boolean'),
  non_author_uses: DS.attr('number'),
  downstream_boards: DS.attr('number'),
  unlinked_buttons: DS.attr('number'),
  forks: DS.attr('number'),
  total_buttons: DS.attr('number'),
  shared_users: DS.attr('raw'),
  sharing_key: DS.attr('string'),
  starred: DS.attr('boolean'),
  stars: DS.attr('number'),
  non_author_starred: DS.attr('boolean'),
  star_or_unstar: function(star) {
    var _this = this;
    console.log(star);
    persistence.ajax('/api/v1/boards/' + this.get('id') + '/stars', {
      type: 'POST',
      data: {
        '_method': (star ? 'POST' : 'DELETE')
      }
    }).then(function(data) {
      _this.set('starred', data.starred);
      _this.set('stars', data.stars);
    }, function() {
      modal.warning(i18n.t('star_failed', "Like action failed"));
    });
  },
  star: function() {
    return this.star_or_unstar(true);
  },
  unstar: function() {
    return this.star_or_unstar(false);
  },
  check_for_copy: function() {
    // TODO: check local records for a user-specific copy as a fallback in case
    // offline
  },
  create_copy: function(user) {
    var board = CoughDrop.store.createRecord('board', {
      parent_board_id: this.get('id'),
      key: this.get('key').split(/\//)[1],
      name: this.get('name'),
      description: this.get('description'),
      image_url: this.get('image_url'),
      license: this.get('license'),
      word_suggestions: this.get('word_suggestions'),
      public: false,
      buttons: this.get('buttons'),
      grid: this.get('grid'),
      for_user_id: (user && user.get('id'))
    });
    return board.save();
  },
  add_button: function(button) {
    var buttons = this.get('buttons') || [];
    var new_button = Ember.$.extend({}, button.raw());
    new_button.id = button.get('id');
    var collision = false;
    var max_id = 0;
    for(var idx = 0; idx < buttons.length; idx++) {
      if(buttons[idx].id == new_button.id) {
        collision = true;
      }
      max_id = Math.max(max_id, parseInt(buttons[idx].id, 10));
    }
    if(collision || !new_button.id) {
      new_button.id = max_id + 1;
    }
    buttons.push(new_button);
    var grid = this.get('grid');
    var placed = false;
    if(grid && grid.order) {
      for(var idx = 0; idx < grid.order.length; idx++) {
        if(grid.order[idx]) {
          for(var jdx = 0; jdx < grid.order[idx].length; jdx++) {
            if(!grid.order[idx][jdx] && !placed) {
              grid.order[idx][jdx] = new_button.id;
              placed = true;
            }
          }
        }
      }
      this.set('grid', Ember.$.extend({}, grid));
    }
    this.set('buttons', [].concat(buttons));
    return new_button.id;
  },
  button_visible: function(button_id) {
    var grid = this.get('grid');
    if(!grid || !grid.order) { return false; }
    for(var idx = 0; idx < grid.order.length; idx++) {
      if(grid.order[idx]) {
        for(var jdx = 0; jdx < grid.order[idx].length; jdx++) {
          if(grid.order[idx][jdx] == button_id) {
            return true;
          }
        }
      }
    }
    return false;
  },
  checkForDataURL: function() {
    this.set('checked_for_data_url', true);
    var url = this.get('icon_url_with_fallback');
    var _this = this;
    if(!this.get('image_data_uri') && url && url.match(/^http/)) {
      return persistence.find_url(url, 'image').then(function(data_uri) {
        _this.set('image_data_uri', data_uri);
        return _this;
      });
    } else if(url && url.match(/^data/)) {
      return Ember.RSVP.resolve(this);
    }
    return Ember.RSVP.reject('no board data url');
  },
  checkForDataURLOnChange: function() {
    this.checkForDataURL().then(null, function() { });
  }.observes('image_url'),
  load_button_set: function() {
    var _this = this;
    if(this.get('button_set')) {
      return Ember.RSVP.resolve(this.get('button_set'));
    }
    var button_set = CoughDrop.store.peekRecord('buttonset', this.get('id'));
    if(button_set) {
      this.set('button_set', button_set);
      return Ember.RSVP.resolve(button_set);
    } else {
      var res = CoughDrop.store.findRecord('buttonset', this.get('id')).then(function(button_set) {
        _this.set('button_set', button_set);
      });
      res.then(null, function() { });
      return res;
    }
  }
});

CoughDrop.Board.reopenClass({
  refresh_data_urls: function() {
    // when you call sync, you're potentially prefetching a bunch of images and
    // sounds that don't have a locally-stored copy yet, so their data-uris will
    // all come up empty. But then if you open one of those boards without
    // refreshing the page, they're stored in the ember-data cache without a
    // data-uri so they fail if you go offline, even though they actually
    // got persisted to the local store. This method tried to address that
    // shortcoming.
    var _this = this;
    Ember.run.later(function() {
      CoughDrop.store.peekAll('board').content.forEach(function(i) {
        i.record.checkForDataURL().then(null, function() { });
      });
      CoughDrop.store.peekAll('image').content.forEach(function(i) {
        i.record.checkForDataURL().then(null, function() { });
      });
      CoughDrop.store.peekAll('sound').content.forEach(function(i) {
        i.record.checkForDataURL().then(null, function() { });
      });
    });
  },
  mimic_server_processing: function(record, hash) {
    if(hash.board.id.match(/^tmp/)) {
      var splits = (hash.board.key || hash.board.id).split(/\//);
      var key = splits[1] || splits[0];
      var rnd = "tmp_" + Math.round(Math.random() * 10000).toString() + (new Date()).getTime().toString();
      hash.board.key = rnd + "/" + key;
    }
    hash.board.permissions = {
      "view": true,
      "edit": true
    };
  
    hash.board.buttons = hash.board.buttons || [];
    delete hash.board.images;
    hash.board.grid = {
      rows: (hash.board.grid && hash.board.grid.rows) || 2,
      columns: (hash.board.grid && hash.board.grid.columns) || 4,
      order: (hash.board.grid && hash.board.grid.order) || []
    };
    for(var idx = 0; idx < hash.board.grid.rows; idx++) {
      hash.board.grid.order[idx] = hash.board.grid.order[idx] || [];
      for(var jdx = 0; jdx < hash.board.grid.columns; jdx++) {
        hash.board.grid.order[idx][jdx] = hash.board.grid.order[idx][jdx] || null;
      }
      if(hash.board.grid.order[idx].length > hash.board.grid.columns) {
        hash.board.grid.order[idx] = hash.board.grid.order[idx].slice(0, hash.board.grid.columns);
      }
    }
    if(hash.board.grid.order.length > hash.board.grid.rows) {
      hash.board.grid.order = hash.board.grid.order.slice(0, hash.board.grid.rows);
    }
    return hash;
  }
});

export default CoughDrop.Board;