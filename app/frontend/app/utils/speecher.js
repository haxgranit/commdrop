import Ember from 'ember';
import capabilities from './capabilities';
import persistence from './persistence';

var speecher = Ember.Object.extend({
  beep_url: "https://opensymbols.s3.amazonaws.com/beep.mp3",
  voices: [],
  refresh_voices: function() {
    var list = [];
    var voices = speecher.scope.speechSynthesis.getVoices();
    for(var idx = 0; idx < voices.length; idx++) {
      list.push((voices._list || voices)[idx]);
    }
    var _this = this;
    capabilities.tts.available_voices().then(function(voices) {
      var more_voices = [];
      voices.forEach(function(voice) {
        if(voice.active) {
          var ref_voice = tts_voices.find_voice(voice.voice_id);
          if(ref_voice) {
            voice.name = ref_voice.name;
            voice.locale = ref_voice.locale;
          }
          more_voices.push({
            lang: voice.locale,
            name: voice.name,
            voiceURI: "extra:" + voice.voice_id
          });
        }
      });
      _this.set('voices', more_voices.concat(list));
    }, function() { });
    if(!this.get('voices') || this.get('voices').length === 0) {
      this.set('voices', list);
    }
    return list;
  },
  check_readiness: function() {
    if(!this.ready) {
      capabilities.tts.init();
    }
    this.ready = true;
    var ios = function() {
      // ios has a weird quirk where sometimes a list of voices shows
      // up, but sometimes it doesn't. this *might* help add consistency.
      // ref: http://stackoverflow.com/questions/28948562/web-speech-api-consistently-get-the-supported-speech-synthesis-voices-on-ios-sa
      var u = new window.SpeechSynthesisUtterance();
      u.text = "test";
      u.lang = "ja-JP";
      u.voice = {name: "ja-JP", voiceURI: "ja-JP", lang: "ja-JP", localService: true, default: true};
      window.speechSynthesis.speak(u);
    };
    if(capabilities.system == 'iOS') {
      ios();
      Ember.run.later(ios, 1000);
    }
//     this.ready = !!(!speecher.scope.speechSynthesis.voiceList || speecher.scope.speechSynthesis.voiceList.length > 0);
  },
  set_voice: function(voice) {
    this.pitch = voice.pitch;
    this.volume = voice.volume;
    this.rate = voice.rate;
    this.voiceURI = null;
    if(voice.voice_uri) {
      var voices = speecher.get('voices');
      var found_voice = voices.find(function(v) { return v.voiceURI == voice.voice_uri; });
      if(found_voice) {
        this.voiceURI = found_voice.voiceURI;
      } else if(!this.voiceURI && voices.length > 0) {
        this.voiceURI = voices[0].voiceURI;
      }
    }
  },
  default_rate: function() {
    var agent = navigator.userAgent.toLowerCase();
    var ios = capabilities.system == 'iOS';
    var too_fast_voice = (ios && capabilities.browser == 'Safari' && (!capabilities.system_version || capabilities.system_version < 9.0));
    if(too_fast_voice) {
      return 0.2;
    }
    return 1.0;
  },
  speak_id: 0,
  speak_text: function(text, from_collection, opts) {
    opts = opts || {};
    var speaking = this.speaking;
    var speaking_from_collection = this.speaking_from_collection;
    if(this.speaking_from_collection && !from_collection) {
      // lets the user start building their next sentence without interrupting the current one
      // TODO: this seems elegant right now, but it is actually a good idea?
      return;
    } else if(this.speaking && opts.interrupt === false) {
      return;
    }
    this.stop('text');
    if(!text) { return; }
    text = text.toString();
    opts.rate = opts.rate || this.rate || this.default_rate();
    opts.volume = opts.volume || this.volume || 1.0;
    opts.pitch = opts.pitch || this.pitch || 1.0;
    opts.voiceURI = opts.voiceURI || this.voiceURI;
    // iOS TTS quirk
    if(text.replace(/\s+/g, '') == "I") { text = "eye"; }
    if(text.replace(/\s+/g, '') == "went") { text = "wend"; }
    var _this = this;
    var speak_id = this.speak_id++;
    this.last_speak_id = speak_id;
    if(speecher.scope.speechSynthesis) {
      if(opts.interrupt !== false) {
        this.speaking = true;
        this.speaking_from_collection = !!from_collection;
      }
      var utterance = new speecher.scope.SpeechSynthesisUtterance();
      utterance.text = text;
      utterance.rate = opts.rate;
      utterance.volume = opts.volume;
      utterance.pitch = opts.pitch;
      utterance.voiceURI = opts.voiceURI;
      var voices = speecher.get('voices');
      var voice = voices.find(function(v) { return v.voiceURI == opts.voiceURI; });
      voice = voice || voices.find(function(v) { return (v.name + " " + v.lang) == opts.voiceURI; });
      voice = voice || voices.find(function(v) { return v.lang == opts.voiceURI; });
      var locale = window.navigator.language.toLowerCase();
      var language = locale && locale.split(/-/)[0];
      voice = voice || voices.find(function(v) { return locale && v.lang && (v.lang.toLowerCase() == locale || v.lang.toLowerCase().replace(/-/, '_') == locale); });
      voice = voice || voices.find(function(v) { return language && v.lang && v.lang.toLowerCase().split(/[-_]/)[0] == language; });
      voice = voice || voices.find(function(v) { return v['default']; });
      
      var speak_utterance = function() {
        utterance.voice = voice;
        if(voice) {
          utterance.lang = voice.lang;
        }
        if(utterance.addEventListener) {
          utterance.addEventListener('end', function() {
            _this.speak_end_handler(speak_id);
          });
        } else {
          utterance.onend = function() {
            _this.speak_end_handler(speak_id);
          };
        }
        speecher.scope.speechSynthesis.speak(utterance);
      };
      
      if(voice && voice.voiceURI && voice.voiceURI.match(/^extra:/)) {
        var voice_id = voice.voiceURI.replace(/^extra:/, '')
        Ember.run.later(function() {
          capabilities.tts.speak_text(text, {
            voice_id: voice_id,
            pitch: utterance.pitch,
            volume: utterance.volume,
            rate: utterance.rate
          }).then(function() {
            // method won't be called until the text is done being spoken or was interrupted
            _this.speak_end_handler(speak_id);
          }, function(err) {
            // method call returns error, fallback to speechSynthesis
            speak_utterance();
          });
        });
      } else {
        speak_utterance();
      }
    } else {
      alert(text);
    }
  },
  next_speak: function() {
    if(this.speaks && this.speaks.length) {
      this.speaking_from_collection = true;
      var speak = this.speaks.shift();
      if(speak.sound) {
        this.speak_audio(speak.sound, 'text', true);
      } else if(speak.text) {
        var stashVolume = this.volume;
        if(speak.volume) { this.volume = speak.volume; }
        this.speak_text(speak.text, true);
        this.volume = stashVolume;
      }
    } else {
      // console.log("no speaks left");
    }
  },
  speak_end_handler: function(speak_id) {
    if(speak_id == speecher.last_speak_id) {
      speecher.speaking_from_collection = false;
      speecher.speaking = false;
      speecher.next_speak();
    } else {
      // console.log('unexpected speak_id');
    }
  },
  speak_background_audio: function(url) {
    this.speak_audio(url, 'background');
  },
  load_beep: function() {
    if(speecher.beep_url) {
      if(speecher.beep_url.match(/^data:/)) { return Ember.RSVP.resolve(true); }
      return persistence.find_url(speecher.beep_url, 'sound').then(function(data_uri) {
        if(data_uri) {
          speecher.beep_url = data_uri;
          return true;
        } else {
          return persistence.store_url(speecher.beep_url).then(function(data) {
            speecher.beep_url = data.data_uri;
            return true;
          });
        }
      }, function() {
        return persistence.store_url(speecher.beep_url).then(function(data) {
          speecher.beep_url = data.data_uri;
          return true;
        });
      });
    } else {
      return Ember.RSVP.reject({error: "beep sound not saved"});
    }
  },
  play_audio: function(elem) {
    // the check for lastListener  is weird, but there was a lag where if you played 
    // the same audio multiple times in a row then it would trigger an 'ended' event
    // on the newly-attached listener. This approach tacks on a new audio element
    // if that's likely to happen. The "throwaway" class and the setTimeouts in here
    // are all to help with that purpose.
    if(elem.lastListener || (capabilities.mobile && capabilities.browser == "Safari")) {
      var audio = document.createElement('audio');
      audio.style.display = "none";
      audio.src = elem.src;
      document.body.appendChild(audio);
      audio.load();
      audio.speak_id = elem.speak_id;
      audio.className = 'throwaway';
      elem = audio;
    }
    elem.pause();
    elem.currentTime = 0;
    var _this = this;
    var speak_id = elem.speak_id;
    if(elem.lastListener) {
      elem.removeEventListener('ended', elem.lastListener);
      elem.removeEventListener('pause', elem.lastListener);
      setTimeout(function() {
        elem.lastListener = null;
      }, 50);
    }
    var handler = function() {
      _this.speak_end_handler(speak_id);
    };
    elem.lastListener = handler;
    elem.addEventListener('ended', handler);
    elem.addEventListener('pause', handler);
    Ember.run.later(function() {
      elem.play();
    }, 10);
    return elem;
  },
  beep: function() {
    var beep = Ember.$("#beep")[0];
    if(!beep) {
      var audio = document.createElement('audio');
      audio.style.display = "none";
      audio.src = speecher.beep_url;
      audio.id = 'beep';
      document.body.appendChild(audio);
      audio.load();
      beep = audio;
    }
    if(beep) {
      this.play_audio(beep);
    } else {
      console.log("beep sound not found");
    }
  },
  speak_audio: function(url, type, from_collection, opts) {
    opts = opts || {};
    if(this.speaking_from_collection && !from_collection) {
      // lets the user start building their next sentence without interrupting the current one
      return;
    } else if(this.speaking && opts.interrupt === false) {
      return;
    }
    if(opts.interrupt !== false) {
      this.speaking = true;
    }
    this.audio = this.audio || {};
    type = type || 'text';
    this.stop(type);
    
    var $audio = this.find_or_create_element(url);
    if($audio.length) {
      var audio = $audio[0];
      if(type == 'text') {
        var speak_id = this.speak_id++;
        this.last_speak_id = speak_id;
        this.speaking = true;
        this.speaking_from_collection = from_collection;
        audio.speak_id = speak_id;
      }
      var playing_audio = this.play_audio(audio);
      this.audio[type] = playing_audio;
    } else {
      console.log("couldn't find sound to play");
    }
  },
  find_or_create_element: function(url) {
    var $res = Ember.$("audio[src='" + url + "']");
    if($res.length === 0) {
      $res = Ember.$("audio[rel='" + url + "']");
    }
    return $res;
  },
  speak_collection: function(list) {
    this.stop('text');
    this.speaks = list;
    this.next_speak();
  },
  stop: function(type) {
    this.audio = this.audio || {};
    type = type || 'all';
    Ember.$("audio.throwaway").remove();
    if(type == 'text' || type == 'all') {
      this.speaking = false;
      this.speaking_from_collection = false;
      // this.speaks = [];
      if((speecher.last_text || "").match(/put/)) { debugger; }
      speecher.scope.speechSynthesis.cancel();
      capabilities.tts.stop_text();
      if(this.audio.text) {
        this.audio.text.pause();
        this.audio.text.removeEventListener('ended', this.audio.text.lastListener);
        this.audio.text.removeEventListener('pause', this.audio.text.lastListener);
        var audio = this.audio.text;
        setTimeout(function() {
          audio.lastListener = null;
        }, 50);
        this.audio.text = null;
      }
    }
    if(type == 'background' || type == 'all') {
      if(this.audio.background) {
        this.audio.background.pause();
        this.audio.background.removeEventListener('ended', this.audio.background.lastListener);
        this.audio.background.removeEventListener('pause', this.audio.background.lastListener);
        var audio = this.audio.background;
        setTimeout(function() {
          audio.lastListener = null;
        }, 50);
        this.audio.background = null;
      }
    }
  }
}).create({scope: (window.polyspeech || window)});
speecher.check_readiness();
window.speecher = speecher;

export default speecher;