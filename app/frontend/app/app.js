import Ember from 'ember';
import DS from 'ember-data';
import Resolver from 'ember/resolver';
import loadInitializers from 'ember/load-initializers';
import config from './config/environment';
import capabilities from './utils/capabilities';
import i18n from './utils/i18n';
import persistence from './utils/persistence';
import coughDropExtras from './utils/extras';
import misc from './utils/misc';

Ember.MODEL_FACTORY_INJECTIONS = true;

Ember.onerror = function(err) {
  if(err.stack) {
    console.error(err.stack);
  } else {
    if(err.fakeXHR && (err.fakeXHR.status == 400 || err.fakeXHR.status == 404)) {
      // should already be logged via "ember ajax error"
    } else if(err.status == 400 || err.status == 404) {
      // should already be logged via "ember ajax error"
    } else if(err._result && err._result.fakeXHR && (err._result.fakeXHR.status == 400 || err._result.fakeXHR.status == 404)) {
      // should already be logged via "ember ajax error"
    } else {
      console.error(JSON.stringify(err));
    }
  }
};

// TODO: nice for catching unexpected errors, but it seems like
// it also triggers anytime a reject isn't caught.
// Ember.RSVP.on('error', function(err) {
//   Ember.Logger.assert(false, err);
//   debugger
// });

var customEvents = {
    'buttonselect': 'buttonSelect',
    'buttonpaint': 'buttonPaint',
    'actionselect': 'actionSelect',
    'symbolselect': 'symbolSelect',
    'rearrange': 'rearrange',
    'clear': 'clear',
    'stash': 'stash',
    'select': 'select'
};

var CoughDrop = Ember.Application.extend({
  modulePrefix: config.modulePrefix,
  podModulePrefix: config.podModulePrefix,
  Resolver: Resolver,
  customEvents: customEvents,
  ready: function() {
    // remove the splash screen if showing
    if(capabilities.installed_app || (navigator && navigator.splashscreen && navigator.splashscreen.hide)) {
      var checkForFooter = function() {
        if(Ember.$("footer").length > 0) {
          if(navigator && navigator.splashscreen && navigator.splashscreen.hide) {
            Ember.run.later(navigator.splashscreen.hide, 500);
          } else {
            console.log("splash screen expected but not found");
          }
        } else {
          Ember.run.later(checkForFooter, 200);
        }
      };
      Ember.run.later(checkForFooter, 200);
    }
  }
});


loadInitializers(CoughDrop, config.modulePrefix);

DS.Model.reopen({
  reload: function(allow_local) {
    if(allow_local !== false) {
      persistence.force_reload = this.get('id');
    }
    return this._super();
  },
  save: function() {
    // TODO: this causes a difficult constraint, because you need to use the result of the
    // promise instead of the original record you were saving in any results, just in case
    // the record object changed. It's not ideal, but we have to do something because DS gets
    // mad now if the server returns a different id, and we use a temporary id when persisted
    // locally.
    if(this.id && this.id.match(/^tmp[_\/]/) && persistence.get('online')) {
      var tmp_id = this.id;
      var tmp_key = this.get('key');
      var type = this._internalModel.modelName;
      var attrs = this._internalModel._attributes;
      var rec = this.store.createRecord(type, attrs);
      rec.tmp_key = tmp_key;
      return rec.save().then(function(result) {
        return persistence.remove(type, {}, tmp_id).then(function() {
          return Ember.RSVP.resolve(result);
        }, function() {
          return Ember.RSVP.reject({error: "failed to remove temporary record"});
        });
      });
    }
    return this._super();
  }
});

Ember.Route.reopen({
  update_title_if_present: function() {
    var controller = this.controllerFor(this.routeName);
    var title = this.get('title') || (controller && controller.get('title'));
    if(title) {
      CoughDrop.controller.updateTitle(title.toString());
    }
  },
  activate: function() {
    this.update_title_if_present();
    var controller = this.controllerFor(this.routeName);
    if(controller) {
      controller.addObserver('title', this, function() {
        this.update_title_if_present();
      });
    }
    this._super();
  }
});

CoughDrop.licenseOptions = [
  {name: i18n.t('private_license', "Private (no reuse allowed)"), id: 'private'},
  {name: i18n.t('cc_by_license', "CC By (attribution only)"), id: 'CC By', url: 'http://creativecommons.org/licenses/by/4.0/'},
  {name: i18n.t('cc_by_sa_license', "CC By-SA (attribution + share-alike)"), id: 'CC By-SA', url: 'http://creativecommons.org/licenses/by-sa/4.0/'},
  {name: i18n.t('public_domain_license', "Public Domain"), id: 'public domain', url: 'http://creativecommons.org/publicdomain/zero/1.0/'}
];
CoughDrop.registrationTypes = [
  {name: i18n.t('pick_type', "[ this login is for ]"), id: ''},
  {name: i18n.t('registration_type_communicator', "A communicator"), id: 'communicator'},
  {name: i18n.t('registration_type_slp', "A therapist"), id: 'therapist'},
  {name: i18n.t('registration_type_parent', "A parent"), id: 'parent'},
  {name: i18n.t('registration_type_eval', "An evaluation/assessment device"), id: 'eval'},
  {name: i18n.t('registration_type_other', "An aide, caregiver or other supporter"), id: 'other'}
];
CoughDrop.parts_of_speech = [
  {name: i18n.t('unspecified', "Unspecified"), id: ''},
  {name: i18n.t('noun', "Noun (dog, Dad)"), id: 'noun'},
  {name: i18n.t('verb', "Verb (jump, fly)"), id: 'verb'},
  {name: i18n.t('adjective', "Adjective (silly, red)"), id: 'adjective'},
  {name: i18n.t('pronoun', "Pronoun (he, they)"), id: 'pronoun'},
  {name: i18n.t('adverb', "Adverb (kindly, often)"), id: 'adverb'},
  {name: i18n.t('question', "Question (why, when)"), id: 'question'},
  {name: i18n.t('conjunction', "Conjunction (and, or)"), id: 'conjunction'},
  {name: i18n.t('negation', "Negation (not, never)"), id: 'negation'},
  {name: i18n.t('preposition', "Preposition (behind, with)"), id: 'preposition'},
  {name: i18n.t('article', "Article (a, an)"), id: 'article'},
  {name: i18n.t('determiner', "Determiner (that, his)"), id: 'determiner'},
  {name: i18n.t('other', "Other word type"), id: 'other'},
  {name: i18n.t('custom_1', "Custom Word Type 1"), id: 'custom_1'},
  {name: i18n.t('custom_2', "Custom Word Type 2"), id: 'custom_2'},
  {name: i18n.t('custom_3', "Custom Word Type 3"), id: 'custom_3'}
];
// derived from http://praacticalaac.org/strategy/communication-boards-colorful-considerations/
// and http://talksense.weebly.com/cbb-8-colour.html
CoughDrop.keyed_colors = [
  {border: "#ccc", fill: "#fff", color: i18n.t('white', "White"), types: ['conjunction']},
  {fill: "#ffa", color: i18n.t('yellow', "Yellow"), hint: i18n.t('people', "people"), types: ['pronoun']},
  {fill: "#cfa", color: i18n.t('green', "Green"), hint: i18n.t('actions', "actions"), types: ['verb']},
  {fill: "#fca", color: i18n.t('orange', "Orange"), hint: i18n.t('nouns', "nouns"), types: ['noun', 'nominative']},
  {fill: "#acf", color: i18n.t('blue', "Blue"), hint: i18n.t('describing_words', "describing words"), types: ['adjective']},
  {fill: "#caf", color: i18n.t('purple', "Purple"), hint: i18n.t('questions', "questions"), types: ['question']},
  {fill: "#faa", color: i18n.t('red', "Red"), hint: i18n.t('negations', "negations"), types: ['negation', 'expletive', 'interjection']},
  {fill: "#fac", color: i18n.t('pink', "Pink"), hint: i18n.t('social_words', "social words"), types: ['preposition']},
  {fill: "#ca8", color: i18n.t('brown', "Brown"), hint: i18n.t('adverbs', "adverbs"), types: ['adverb']},
  {fill: "#ccc", color: i18n.t('gray', "Gray"), hint: i18n.t('determiners', "determiners"), types: ['article', 'determiner']}
];

CoughDrop.licenseOptions.license_url = function(id) {
  for(var idx = 0; idx < CoughDrop.licenseOptions.length; idx++) {
    if(CoughDrop.licenseOptions[idx].id == id) {
      return CoughDrop.licenseOptions[idx].url;
    }
  }
  return "";
};

CoughDrop.iconUrls = [
    {alt: 'house', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/house.svg'},
    {alt: 'food', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/food.svg'},
    {alt: 'verbs', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/verbs.png'},
    {alt: 'describe', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/to%20explain.png'},
    {alt: 'you', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/you.png'},
    {alt: 'questions', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/ask_2.png'},
    {alt: 'people', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/group%20of%20people_2.png'},
    {alt: 'time', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/clock-watch_6.png'},
    {alt: 'city', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/place.png'},
    {alt: 'world', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/world.svg'},
    {alt: 'clothing', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/clothes.png'},
    {alt: 'cheeseburger', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/cheese%20burger.svg'},
    {alt: 'school', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/school%20bag.svg'},
    {alt: 'fish', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/fish.svg'},
    {alt: 'party', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/party_3.png'},
    {alt: 'shoe', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/shoes_8.png'},
    {alt: 'boy', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/boy_1.png'},
    {alt: 'girl', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/girl_1.png'},
    {alt: 'toilet', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/toilet.svg'},
    {alt: 'car', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/car.png'},
    {alt: 'sun', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/sun.svg'},
    {alt: 'snowman', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/snowman.png'},
    {alt: 'bed', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/bed.png'},
    {alt: 'computer', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/computer_2.png'},
    {alt: 'phone', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/mobile%20phone.png'},
    {alt: 'board', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/board_3.png'}
];
CoughDrop.avatarUrls = [
  {alt: 'happy female', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/happy.png'},
  {alt: 'happy', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/happy%20look_1.png'},
  {alt: 'teacher', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/teacher%20(female).png'},
  {alt: 'female doctor', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/doctor_3.png'},
  {alt: 'male doctor', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/doctor_1.png'},
  {alt: 'speech therapist', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/speech%20therapist_1.png'},
  {alt: 'mother', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/mother.png'},
  {alt: 'father', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/father.png'},
  {alt: 'girl', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/girl_2.png'},
  {alt: 'girl face', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/girl_3.png'},
  {alt: 'boy', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/boy_3.png'},
  {alt: 'boy face', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/boy_2.png'},
  {alt: 'boy autism', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/autistic%20boy.png'},
  {alt: 'girl autism', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/autistic%20girl.png'},
  {alt: 'cat', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/cat.svg'},
  {alt: 'dog', url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/dog.png'},
  {alt: 'car', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/car.svg'},
  {alt: 'train', url: 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/train.svg'},
  {alt: 'bees', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/bees.png'},
  {alt: 'butterfly', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/butterfly2.png'},
  {alt: 'robocat', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/cat_cub.png'},
  {alt: 'caterpillar', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/caterpiller.png'},
  {alt: 'cauldron', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/cauldron.png'},
  {alt: 'cupcake', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/cupcake.png'},
  {alt: 'cyclops', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/cyclops.png'},
  {alt: 'dragon', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/dragon.png'},
  {alt: 'dragonfly', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/dragonfly.png'},
  {alt: 'earth', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/earth.png'},
  {alt: 'fairy', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/fairy_flying.png'},
  {alt: 'fairy with ruffles', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/fairyruffles.png'},
  {alt: 'book', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/fairytale.png'},
  {alt: 'lizard', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/findragon.png'},
  {alt: 'flower', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/flower.png'},
  {alt: 'gears', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/gears.png'},
  {alt: 'gryphon', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/gryphon.png'},
  {alt: 'hearts', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/hearts.png'},
  {alt: 'horse', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/horse.png'},
  {alt: 'ladybug', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/ladybug.png'},
  {alt: 'firefly', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/lightningbug.png'},
  {alt: 'lion', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/lion.png'},
  {alt: 'harp', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/lyre.png'},
  {alt: 'medusa', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/medusa.png'},
  {alt: 'rainbow', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/rainbow.png'},
  {alt: 'roar', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/roar.png'},
  {alt: 'robot', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/robot.png'},
  {alt: 'scorpion', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/scorpion.png'},
  {alt: 'mermaid', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/siren.png'},
  {alt: 'snakes', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/snakes.png'},
  {alt: 'sprite', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/sprite.png'},
  {alt: 'sun', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/sun2.png'},
  {alt: 'tiger', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/tiger.png'},
  {alt: 'frog', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/toad.png'},
  {alt: 'triceratops', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/triceratops.png'},
  {alt: 'wizard', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/wizard.png'},
  {alt: 'zombie', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/zombie.png'},
  {alt: 'stegosaurus', url: 'https://s3.amazonaws.com/opensymbols/libraries/language-craft/stegosaurus.png'}
];

CoughDrop.YT = {
  track: function(player_id, callback) {
    return new Ember.RSVP.Promise(function(resolve, reject) {
      if(!CoughDrop.YT.ready) {
        var tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);    
        window.onYouTubeIframeAPIReady = function() {
          CoughDrop.YT.ready = true;
          CoughDrop.YT.track(player_id, callback).then(function(player) {
            resolve(player);
          }, function() { reject('no_player'); });
        };
      } else {
        setTimeout(function() {
          var player = Ember.Object.extend({
            current_time: function() {
              var p = this.get('_player');
              return p && p.getCurrentTime && p.getCurrentTime();
            },
            cleanup: function() {
              this.set('disabled', true);
            },
            pause: function() {
              var p = this.get('_player');
              if(p && p.pauseVideo) {
                p.pauseVideo();
              }
            },
            play: function() {
              var p = this.get('_player');
              if(p && p.playVideo) {
                p.playVideo();
              }
            }
          }).create();
          player.set('_player', new window.YT.Player(player_id, {
            events: {
              'onStateChange': function(event) {
                if(callback) {
                  if(event.data == window.YT.PlayerState.ENDED) {
                    callback('end');
                    player.set('paused', false);
                  } else if(event.data == window.YT.PlayerState.PAUSED) {
                    callback('pause');
                    player.set('paused', true);
                  } else if(event.data == window.YT.PlayerState.CUED) {
                    callback('pause');
                    player.set('paused', true);
                  } else if(event.data == window.YT.PlayerState.PLAYING) {
                    callback('play');
                    player.set('paused', false);
                  }
                }
              }
            }
          }));
          CoughDrop.YT.players = CoughDrop.YT.players || [];
          CoughDrop.YT.players.push(player);
          resolve(player);
        }, 200);
      }
    });
  },
  poll: function() {
    (CoughDrop.YT.players || []).forEach(function(player) {
      if(!player.get('disabled')) {
        var p = player.get('_player');
        if(p && p.getDuration) {
          player.set('duration', Math.round(p.getDuration()));
        }
        if(p && p.getCurrentTime) {
          player.set('time', Math.round(p.getCurrentTime()));
        }
        if(p && p.getPlayerState) {
          var state = p.getPlayerState();
          if(state == window.YT.PlayerState.PLAYING) {
            player.set('paused', false);
            if(!p.started) {
              p.started = true;
              player.set('started', true);
            }
          } else {
            player.set('paused', true);
          }
        }
      }
    });
    Ember.run.later(CoughDrop.YT.poll, 100);
  }
};
Ember.run.later(CoughDrop.YT.poll, 500);

CoughDrop.Visualizations = {
  wait: function(name, callback) {
    if(!CoughDrop.Visualizations.ready) {
      CoughDrop.Visualizations.callbacks = CoughDrop.Visualizations.callbacks || [];
//       var found = CoughDrop.Visualizations.callbacks.find(function(cb) { return cb.name == name; });
//       if(!found) {
        CoughDrop.Visualizations.callbacks.push({
          name: name,
          callback: callback
        });
//       }
      CoughDrop.Visualizations.init();
    } else {
      callback();
    }
  },
  handle_callbacks: function() {
    CoughDrop.Visualizations.initializing = false;
    CoughDrop.Visualizations.ready = true;
    (CoughDrop.Visualizations.callbacks || []).forEach(function(obj) {
      obj.callback();
    });
    CoughDrop.Visualizations.callbacks = [];
  },
  init: function() {
    if(CoughDrop.Visualizations.initializing || CoughDrop.Visualizations.ready) { return; }
    CoughDrop.Visualizations.initializing = true;
    if(!window.google || !window.google.visualization || !window.google.maps) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      
      var one_done = function(type) {
        one_done[type] = true;
        if(one_done.graphs && one_done.maps) {
          window.google.load("visualization", "1.1", {packages:["corechart", "sankey"], callback: CoughDrop.Visualizations.handle_callbacks});
        }
      };
      
      window.ready_to_load_graphs = function() {
        one_done('graphs');
      };
      script.src = 'https://www.google.com/jsapi?callback=ready_to_load_graphs';
      document.body.appendChild(script);

      window.ready_to_do_maps = function() {
        one_done('maps');
      };
      var script = document.createElement('script');
      script.type = 'text/javascript';
      // TODO: pull api keys out into config file?
      script.src = 'https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false&' +
          'callback=ready_to_do_maps&key=AIzaSyBofHMEAGEILQkXWAgO6fAbsLjw6fNJQwM';
      document.body.appendChild(script);
    } else {
      Ember.run.later(CoughDrop.Visualizations.handle_callbacks);
    }
    
  }
};

CoughDrop.boxPad = 17;
CoughDrop.borderPad = 5;
CoughDrop.labelHeight = 15;
CoughDrop.customEvents = customEvents;
CoughDrop.expired = function() {
  var keys = window.app_version.match(/(\d+)\.(\d+)\.(\d+)/);
  var version = parseInt(keys[1] + keys[2] + keys[3], 10);
  var now = parseInt(window.moment().format('YYYYMMDD'), 10);
  var diff = now - version;
  return diff > 30;
};
window.CoughDrop = CoughDrop;
window.CoughDrop.VERSION = window.app_version;

export default CoughDrop;
