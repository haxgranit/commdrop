import Ember from 'ember';
import EmberObject from '@ember/object';
import capabilities from './capabilities';

var voices = EmberObject.extend({
  find_voice: function(voice_id) {
    var res = null;
    this.get('voices').forEach(function(voice) {
      if(!res && (voice.voice_id == voice_id || voice_id.match(voice.ref_id))) {
        res = voice;
      }
    });
    return res;
  },
  computed_voices: function() {
    var res = this.get('voices');
    res.forEach(function(voice) {
      if(voice.voice_id.match(/^acap/)) {
        voice.name = voice.name || voice.voice_id.split(/:/)[1];
        if(voice.voice_dir) {
          voice.voice_url = "https://s3.amazonaws.com/coughdrop/voices/" + voice.voice_dir + ".zip";
        }
        if(capabilities.installed_app && (capabilities.system == 'iOS' || capabilities.system == 'Android') && voice.voice_dir_v2018) {
          voice.voice_url = "https://s3.amazonaws.com/coughdrop/voices/v2018/" + voice.voice_dir_v2018 + ".zip";
        }
        voice.voice_sample = voice.voice_sample || "https://s3.amazonaws.com/coughdrop/voices/" + voice.name.toLowerCase() + "-sample.mp3";
        voice.language_dir = voice.voice_dir.split(/-/)[2];
        voice.windows_available = !!(voice.language_dir && voice.language_dir !== "");
        voice.windows_language_url = "https://s3.amazonaws.com/coughdrop/voices/" + voice.language_dir + ".zip";
        if(voice.language_version && voice.language_version !== "") {
          voice.windows_language_url = "https://s3.amazonaws.com/coughdrop/voices/" + voice.language_dir + "-" + voice.language_version + ".zip";
        }
        voice.windows_voice_url = voice.voice_url.replace(/\.zip/, '.win.zip');
        voice.hq = true;
      }
    });
    return res;
  }.property('voices'),
  all: function() {
    return this.get('computed_voices').filter(function(v) { return v.voice_url; });
  }
}).create({
  prompts: {
    "en": "Do you like my voice?",
    "fr": "Aimez-vous ma voix?",
    "es": "Te gusta mi voz?",
    "de": "Magst du meine Stimme?",
    "ar": "هل اعجبك صوتي؟",
    "nl": "Vind je mijn stem leuk?",
    "pt": "Você gosta da minha voz?",
    "ca": "T'agrada la meva veu?",
    "cs": "Líbí se ti můj hlas?",
    "da": "Kan du lide min stemme?",
    "sv": "Gillar du min röst?",
    "nn": "Liker du stemmen min?",
    "el": "Σας αρέσει η φωνή μου;",
    "it": "ti piace la mia voce?",
    "ja": "私の声が好きですか？",
    "ko": "내 목소리가 마음에 드십니까?",
    "zh": "你喜欢我的声音吗？",
    "pl": "Czy podoba ci się mój głos?",
    "ru": "Тебе нравится мой голос?",
    "tr": "Sesimi sever misin?"
  },
  voices: [
    {
      name: "Ella", voice_id: "acap:Ella", size: 100,
      locale: "en-US", gender: "f", age: "child", hq: true,
      voice_dir: "hqm-ref-USEnglish-Ella-22khz",
      voice_dir_v2018: "hq-ref-USEnglish-Ella-22khz",
      ref_id: "enu_ella_22k_ns",
      language_version: "1.288"
    },
    {
      name: "Josh", voice_id: "acap:Josh", size: 63,
      locale: "en-US", gender: "m", age: "child", hq: true,
      voice_dir: "hqm-ref-USEnglish-Josh-22khz",
      voice_dir_v2018: "hq-ref-USEnglish-Josh-22khz",
      ref_id: "enu_josh_22k_ns",
      language_version: "1.288"
    },
    {
      name: "Scott", voice_id: "acap:Scott", size: 86,
      locale: "en-US", gender: "m", age: "teen", hq: true,
      voice_dir: "hqm-ref-USEnglish-Scott-22khz",
      voice_dir_v2018: "hq-ref-USEnglish-Scott-22khz",
      ref_id: "enu_scott_22k_ns",
      language_version: "1.288"
    },
    {
      name: "Emilio", voice_id: "acap:Emilio", size: 55,
      locale: "en-US", gender: "m", age: "child", hq: true,
      voice_dir: "hqm-ref-USEnglish-Emilio-English-22khz",
      voice_dir_v2018: "hq-ref-USEnglish-Emilio-English-22khz",
      ref_id: "enu_emilioenglish_22k_ns",
      language_version: "1.288"
    },
    {
      name: "Valeria", voice_id: "acap:Valeria", size: 52,
      locale: "en-US", gender: "f", age: "child", hq: true,
      voice_dir: "hqm-ref-USEnglish-Valeria-English-22khz",
      voice_dir_v2018: "hq-ref-USEnglish-Valeria-English-22khz",
      ref_id: "enu_valeriaenglish_22k_ns",
      language_version: "1.288"
    },
    {
      name: "Emilio", voice_id: "acap:Emilio", size: 49,
      locale: "es-US", gender: "m", age: "child", hq: true,
      voice_dir_v2018: "hq-ref-USSpanish-Emilio-22khz",
      ref_id: "emilio_22k_ns",
      language_version: "1.288"
    },
    {
      name: "Valeria", voice_id: "acap:Valeria", size: 51,
      locale: "es-US", gender: "f", age: "child", hq: true,
      voice_dir_v2018: "hq-ref-USSpanish-Valeria-22khz",
      ref_id: "valeria_22k_ns",
      language_version: "1.288"
    },
    {
      voice_id: "acap:Karen", size: 26,
      locale: "en-US", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Karen-22khz",
      ref_id: "enu_karen_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Karen-22khz"
    },
    {
      voice_id: "acap:Kenny", size: 59,
      locale: "en-US", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Kenny-22khz",
      ref_id: "enu_kenny_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Kenny-22khz"
    },
    {
      voice_id: "acap:Laura", size: 60,
      locale: "en-US", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Laura-22khz",
      ref_id: "enu_laura_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Laura-22khz"
    },
    {
      voice_id: "acap:Micah", size: 28,
      locale: "en-US", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Micah-22khz",
      ref_id: "enu_micah_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Micah-22khz"
    },
    {
      voice_id: "acap:Nelly", size: 53,
      locale: "en-US", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Nelly-22khz",
      ref_id: "enu_nelly_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Nelly-22khz"
    },
    {
      voice_id: "acap:Rod", size: 59,
      locale: "en-US", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Rod-22khz",
      ref_id: "enu_rod_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Rod-22khz"
    },
    {
      voice_id: "acap:Ryan", size: 59,
      locale: "en-US", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Ryan-22khz",
      ref_id: "enu_ryan_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Ryan-22khz"
    },
    {
      voice_id: "acap:Saul", size: 34,
      locale: "en-US", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Saul-22khz",
      ref_id: "enu_saul_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Saul-22khz"
    },
    {
      voice_id: "acap:Sharon", size: 229,
      locale: "en-US", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Sharon-22khz",
      ref_id: "enu_sharon_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Sharon-22khz"
    },
    {
      voice_id: "acap:Sharona", size: 52,
      locale: "en-US", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Sharona-22khz",
      ref_id: "enu_sharona_22k_ns",
      language_version: "",
      voice_dir: "hqm-ref-USEnglish-Sharona-22khz"
    },
    {
      voice_id: "acap:Tracy", size: 74,
      locale: "en-US", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Tracy-22khz",
      ref_id: "enu_tracy_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Tracy-22khz"
    },
    {
      voice_id: "acap:Will", size: 41,
      locale: "en-US", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Will-22khz",
      ref_id: "enu_will_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USEnglish-Will-22khz"
    },
    {
      voice_id: "acap:Will-Bad-Guy", size: 33,
      locale: "en-US", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Willbadguy-22khz",
      ref_id: "enu_willbadguy_22k_ns",
      language_version: "",
      voice_dir: "hqm-ref-USEnglish-Willbadguy-22khz"
    },
    {
      voice_id: "acap:Will-Happy", size: 27,
      locale: "en-US", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-WillHappy-22khz",
      ref_id: "enu_willhappy_22k_ns",
      language_version: "",
      voice_dir: "hqm-ref-USEnglish-WillHappy-22khz"
    },
    {
      voice_id: "acap:Will-Little-Creature", size: 35,
      locale: "en-US", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-USEnglish-Willlittlecreature-22khz",
      ref_id: "enu_willlittlecreature_22k_ns",
      language_version: "",
      voice_dir: "hqm-ref-USEnglish-Willlittlecreature-22khz"
    },
    {
      name: "Liam", voice_id: "acap:Liam", size: 68,
      locale: "en-AU", gender: "m", age: "child", hq: true,
      voice_dir: "hqm-ref-AustralianEnglish-Liam-22khz",
      voice_dir_v2018: "hq-ref-AustralianEnglish-Liam-22khz",
      ref_id: "en_au_liam_22k_ns",
      language_version: "1.59"
    },
    {
      name: "Olivia", voice_id: "acap:Olivia", size: 69,
      locale: "en-AU", gender: "f", age: "child", hq: true,
      voice_dir: "hqm-ref-AustralianEnglish-Olivia-22khz",
      voice_dir_v2018: "hq-ref-AustralianEnglish-Olivia-22khz",
      ref_id: "en_au_olivia_22k_ns",
      language_version: "1.59"
    },
    {
      voice_id: "acap:Lisa", size: 81,
      locale: "en-AU", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-AustralianEnglish-Lisa-22khz",
      ref_id: "en_au_lisa_22k_ns",
      language_version: "1.59",
      voice_dir: "hqm-ref-AustralianEnglish-Lisa-22khz"
    },
    {
      voice_id: "acap:Tyler", size: 47,
      locale: "en-AU", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-AustralianEnglish-Tyler-22khz",
      ref_id: "en_au_tyler_22k_ns",
      language_version: "1.59",
      voice_dir: "hqm-ref-AustralianEnglish-Tyler-22khz"
    },
    {
      name: "Harry", voice_id: "acap:Harry", size: 84,
      locale: "en-UK", gender: "m", age: "child", hq: true,
      voice_dir: "hqm-ref-British-Harry-22khz",
      voice_dir_v2018: "hq-ref-British-Harry-22khz",
      ref_id: "eng_harry_22k_ns",
      language_version: "1.187"
    },
    {
      name: "Rosie", voice_id: "acap:Rosie", size: 80,
      locale: "en-UK", gender: "f", age: "child", hq: true,
      voice_dir: "hqm-ref-British-Rosie-22khz",
      voice_dir_v2018: "hq-ref-British-Rosie-22khz",
      ref_id: "eng_rosie_22k_ns",
      language_version: "1.187"
    },
    {
      voice_id: "acap:Graham", size: 63,
      locale: "en-UK", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-British-Graham-22khz",
      ref_id: "eng_graham_22k_ns",
      language_version: "1.187",
      voice_dir: "hqm-ref-British-Graham-22khz"
    },
    {
      voice_id: "acap:Lucy", size: 53,
      locale: "en-UK", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-British-Lucy-22khz",
      ref_id: "eng_lucy_22k_ns",
      language_version: "1.187",
      voice_dir: "hqm-ref-British-Lucy-22khz"
    },
    {
      voice_id: "acap:Nizareng", size: 28,
      locale: "en-UK", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-British-Nizareng-22khz",
      ref_id: "eng_nizareng_22k_ns",
      language_version: "1.187",
      voice_dir: "hqm-ref-British-Nizareng-22khz"
    },
    {
      voice_id: "acap:Peter", size: 139,
      locale: "en-UK", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-British-Peter-22khz",
      ref_id: "eng_peter_22k_ns",
      language_version: "1.187",
      voice_dir: "hqm-ref-British-Peter-22khz"
    },
    {
      voice_id: "acap:Queen-Elizabeth", size: 44,
      locale: "en-UK", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-British-Queenelizabeth-22khz",
      ref_id: "eng_queenelizabeth_22k_ns",
      language_version: "1.187",
      voice_dir: "hqm-ref-British-Queenelizabeth-22khz"
    },
    {
      voice_id: "acap:Rachel", size: 86,
      locale: "en-UK", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-British-Rachel-22khz",
      ref_id: "eng_rachel_22k_ns",
      language_version: "1.187",
      voice_dir: "hqm-ref-British-Rachel-22khz"
    },
    {
      name: "Jonas", voice_id: "acap:Jonas", size: 77,
      locale: "de-DE", gender: "m", age: "child", hq: true,
      voice_dir_v2018: "hq-ref-German-Jonas-22khz",
      ref_id: "ged_jonas_22k_ns",
      voice_dir: "hqm-ref-German-Jonas-22khz",
      language_version: "1.182"
    },
    {
      name: "Lea", voice_id: "acap:Lea", size: 81,
      locale: "de-DE", gender: "f", age: "child", hq: true,
      voice_dir_v2018: "hq-ref-German-Lea-22khz",
      ref_id: "ged_lea_22k_ns",
      voice_dir: "hqm-ref-German-Lea-22khz",
      language_version: "1.182"
    },
    {
      voice_id: "acap:Andreas", size: 114,
      locale: "de-DE", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-German-Andreas-22khz",
      ref_id: "ged_andreas_22k_ns",
      language_version: "1.182",
      voice_dir: "hqm-ref-German-Andreas-22khz"
    },
    {
      voice_id: "acap:Claudia", size: 190,
      locale: "de-DE", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-German-Claudia-22khz",
      ref_id: "ged_claudia_22k_ns",
      language_version: "1.182",
      voice_dir: "hqm-ref-German-Claudia-22khz"
    },
    {
      voice_id: "acap:Julia", size: 102,
      locale: "de-DE", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-German-Julia-22khz",
      ref_id: "ged_julia_22k_ns",
      language_version: "1.182",
      voice_dir: "hqm-ref-German-Julia-22khz"
    },
    {
      voice_id: "acap:Klaus", size: 120,
      locale: "de-DE", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-German-Klaus-22khz",
      ref_id: "ged_klaus_22k_ns",
      language_version: "1.182",
      voice_dir: "hqm-ref-German-Klaus-22khz"
    },
    {
      voice_id: "acap:Sarah", size: 90,
      locale: "de-DE", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-German-Sarah-22khz",
      ref_id: "ged_sarah_22k_ns",
      language_version: "1.182",
      voice_dir: "hqm-ref-German-Sarah-22khz"
    },
    {
      voice_id: "acap:Leila", size: 62,
      locale: "ar-EG", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Arabic-leila-22khz",
      ref_id: "ar_sa_leila_22k_ns",
      language_version: "",
      voice_dir: "hqm-ref-Arabic-leila-22khz"
    },
    {
      voice_id: "acap:Mehdi", size: 58,
      locale: "ar-EG", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Arabic-mehdi-22khz",
      ref_id: "ar_sa_mehdi_22k_ns",
      language_version: "",
      voice_dir: "hqm-ref-Arabic-mehdi-22khz"
    },
    {
      voice_id: "acap:Nizar", size: 64,
      locale: "ar-EG", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Arabic-nizar-22khz",
      ref_id: "ar_sa_nizar_22k_ns",
      language_version: "",
      voice_dir: "hqm-ref-Arabic-nizar-22khz"
    },
    {
      voice_id: "acap:Salma", size: 76,
      locale: "ar-EG", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Arabic-salma-22khz",
      ref_id: "ar_sa_salma_22k_ns",
      language_version: "",
      voice_dir: "hqm-ref-Arabic-salma-22khz"
    },
    {
      voice_id: "acap:Jeroen", size: 88,
      locale: "nl-BE", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-BelgianDutch-Jeroen-22khz",
      ref_id: "dub_jeroen_22k_ns",
      language_version: "1.145",
      voice_dir: "hqm-ref-BelgianDutch-Jeroen-22khz"
    },
    {
      voice_id: "acap:Sofie", size: 81,
      locale: "nl-BE", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-BelgianDutch-Sofie-22khz",
      ref_id: "dub_sofie_22k_ns",
      language_version: "1.145",
      voice_dir: "hqm-ref-BelgianDutch-Sofie-22khz"
    },
    {
      voice_id: "acap:Zoe", size: 85,
      locale: "nl-BE", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-BelgianDutch-Zoe-22khz",
      ref_id: "dub_zoe_22k_ns",
      language_version: "1.145",
      voice_dir: "hqm-ref-BelgianDutch-Zoe-22khz"
    },
    {
      voice_id: "acap:Marcia", size: 91,
      locale: "pt-BR", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Brazilian-Marcia-22khz",
      ref_id: "pob_marcia_22k_ns",
      language_version: "1.112",
      voice_dir: "hqm-ref-Brazilian-Marcia-22khz"
    },
    {
      voice_id: "acap:Louise", size: 60,
      locale: "fr-CA", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-CanadianFrench-Louise-22khz",
      ref_id: "frc_louise_22k_ns",
      language_version: "1.99",
      voice_dir: "hqm-ref-CanadianFrench-Louise-22khz"
    },
    {
      voice_id: "acap:Laia", size: 108,
      locale: "ca-ES", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Catalan-Laia-22khz",
      ref_id: "ca_es_laia_22k_ns",
      language_version: "1.88",
      voice_dir: "hqm-ref-Catalan-Laia-22khz"
    },
    {
      voice_id: "acap:Eliska", size: 101,
      locale: "cs-CZ", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Czech-Eliska-22khz",
      ref_id: "czc_eliska_22k_ns",
      language_version: "1.123",
      voice_dir: "hqm-ref-Czech-Eliska-22khz"
    },
    {
      voice_id: "acap:Mette", size: 96,
      locale: "da-DK", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Danish-Mette-22khz",
      ref_id: "dad_mette_22k_ns",
      language_version: "1.137",
      voice_dir: "hqm-ref-Danish-Mette-22khz"
    },
    {
      voice_id: "acap:Rasmus", size: 84,
      locale: "da-DK", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Danish-Rasmus-22khz",
      ref_id: "dad_rasmus_22k_ns",
      language_version: "1.137",
      voice_dir: "hqm-ref-Danish-Rasmus-22khz"
    },
    {
      voice_id: "acap:Daan", size: 80,
      locale: "nl-NL", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Dutch-Daan-22khz",
      ref_id: "dun_daan_22k_ns",
      language_version: "1.160",
      voice_dir: "hqm-ref-Dutch-Daan-22khz"
    },
    {
      voice_id: "acap:Femke", size: 86,
      locale: "nl-NL", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Dutch-Femke-22khz",
      ref_id: "dun_femke_22k_ns",
      language_version: "1.160",
      voice_dir: "hqm-ref-Dutch-Femke-22khz"
    },
    {
      voice_id: "acap:Jasmijn", size: 77,
      locale: "nl-NL", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Dutch-Jasmijn-22khz",
      ref_id: "dun_jasmijn_22k_ns",
      language_version: "1.160",
      voice_dir: "hqm-ref-Dutch-Jasmijn-22khz"
    },
    {
      voice_id: "acap:Max", size: 66,
      locale: "nl-NL", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Dutch-Max-22khz",
      ref_id: "dun_max_22k_ns",
      language_version: "1.160",
      voice_dir: "hqm-ref-Dutch-Max-22khz"
    },
    {
      voice_id: "acap:Samuel", size: 77,
      locale: "sv-FI", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-FinlandSwedish-samuel-22khz",
      ref_id: "sv_fi_samuel_22k_ns",
      language_version: "1.77",
      voice_dir: "hqm-ref-FinlandSwedish-samuel-22khz"
    },
    {
      voice_id: "acap:Sanna", size: 95,
      locale: "sv-FI", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Finnish-Sanna-22khz",
      ref_id: "fif_sanna_22k_ns",
      language_version: "1.95",
      voice_dir: "hqm-ref-Finnish-Sanna-22khz"
    },
    {
      voice_id: "acap:Elise", size: 54,
      locale: "fr-FR", gender: "f", age: "child",
      voice_dir_v2018: "hq-ref-French-Elise-22khz",
      ref_id: "elise_22k_ns"
    },
    {
      voice_id: "acap:Valentin", size: 45,
      locale: "fr-FR", gender: "m", age: "child",
      voice_dir_v2018: "hq-ref-French-Valentin-22khz",
      ref_id: "valentin_22k_ns"
    },
    {
      voice_id: "acap:Alice", size: 52,
      locale: "fr-FR", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-French-Alice-22khz",
      ref_id: "frf_alice_22k_ns",
      language_version: "1.299",
      voice_dir: "hqm-ref-French-Alice-22khz"
    },
    {
      voice_id: "acap:Anais", size: 123,
      locale: "fr-FR", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-French-Anais-22khz",
      ref_id: "frf_anais_22k_ns",
      language_version: "1.299"
    },
    {
      voice_id: "acap:Antoine", size: 39,
      locale: "fr-FR", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-French-Antoine-22khz",
      ref_id: "frf_antoine_22k_ns",
      language_version: "1.299",
      voice_dir: "hqm-ref-French-Antoine-22khz"
    },
    {
      voice_id: "acap:Bruno", size: 49,
      locale: "fr-FR", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-French-Bruno-22khz",
      ref_id: "frf_bruno_22k_ns",
      language_version: "1.299",
      voice_dir: "hqm-ref-French-Bruno-22khz"
    },
    {
      voice_id: "acap:Claire", size: 50,
      locale: "fr-FR", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-French-Claire-22khz",
      ref_id: "frf_claire_22k_ns",
      language_version: "1.299",
      voice_dir: "hqm-ref-French-Claire-22khz"
    },
    {
      voice_id: "acap:Julie", size: 45,
      locale: "fr-FR", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-French-Julie-22khz",
      ref_id: "frf_julie_22k_ns",
      language_version: "1.299",
      voice_dir: "hqm-ref-French-Julie-22khz"
    },
    {
      voice_id: "acap:Manon", size: 166,
      locale: "fr-FR", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-French-Manon-22khz",
      ref_id: "frf_manon_22k_ns",
      language_version: "1.299",
      voice_dir: "hqm-ref-French-Manon-22khz"
    },
    {
      voice_id: "acap:Margaux", size: 50,
      locale: "fr-FR", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-French-Margaux-22khz",
      ref_id: "frf_margaux_22k_ns",
      language_version: "1.299",
      voice_dir: "hqm-ref-French-Margaux-22khz"
    },
    {
      voice_id: "acap:Elias", size: 76,
      locale: "nn-NO", gender: "m", age: "child",
      voice_dir_v2018: "hq-ref-Norwegian-Elias-22khz",
      ref_id: "elias_22k_ns"
    },
    {
      voice_id: "acap:Emilie", size: 80,
      locale: "nn-NO", gender: "f", age: "child",
      voice_dir_v2018: "hq-ref-Norwegian-Emilie-22khz",
      ref_id: "emilie_22k_ns"
    },
    {
      voice_id: "acap:Filip", size: 92,
      locale: "sv-SE", gender: "m", age: "child",
      voice_dir_v2018: "hq-ref-Swedish-Filip-22khz",
      ref_id: "filip_22k_ns",
    },
    {
      voice_id: "acap:Freja", size: 84,
      locale: "sv-SE", gender: "f", age: "child",
      voice_dir_v2018: "hq-ref-Swedish-Freja-22khz",
      ref_id: "freja_22k_ns",
    },
    {
      voice_id: "acap:Kal", size: 56,
      locale: "sv-SE", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-GothenburgSwedish-Kal-22khz",
      ref_id: "gb_se_kal_22k_ns",
      language_version: "1.51",
      voice_dir: "hqm-ref-GothenburgSwedish-Kal-22khz"
    },
    {
      voice_id: "acap:Dimitris", size: 88,
      locale: "el-GR", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Greek-Dimitris-22khz",
      ref_id: "grg_dimitris_22k_ns",
      language_version: "1.84",
      voice_dir: "hqm-ref-Greek-Dimitris-22khz"
    },
    {
      voice_id: "acap:Deepa", size: 94,
      locale: "en-IN", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-IndianEnglish-Deepa-22khz",
      ref_id: "en_in_deepa_22k_ns",
      language_version: "1.69",
      voice_dir: "hqm-ref-IndianEnglish-Deepa-22khz"
    },
    {
      voice_id: "acap:Chiara", size: 91,
      locale: "it_IT", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Italian-Chiara-22khz",
      ref_id: "iti_chiara_22k_ns",
      language_version: "1.155",
      voice_dir: "hqm-ref-Italian-Chiara-22khz"
    },
    {
      voice_id: "acap:Fabiana", size: 92,
      locale: "it_IT", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Italian-Fabiana-22khz",
      ref_id: "iti_fabiana_22k_ns"
    },
    {
      voice_id: "acap:Vittorio", size: 140,
      locale: "it_IT", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Italian-Vittorio-22khz",
      ref_id: "iti_vittorio_22k_ns"
    },
    {
      voice_id: "acap:Alessio", size: 55,
      locale: "it-IT", gender: "m", age: "child",
      voice_dir_v2018: "hq-ref-Italian-Alessio-22khz",
      ref_id: "alessio_22k_ns"
    },
    {
      voice_id: "acap:Aurora", size: 57,
      locale: "it-IT", gender: "m", age: "child",
      voice_dir_v2018: "hq-ref-Italian-Aurora-22khz",
      ref_id: "aurora_22k_ns"
    },
    {
      voice_id: "acap:Fabiana", size: 87,
      locale: "it-IT", gender: "f", age: "adult",
      voice_dir_v2018: null,
      ref_id: "iti_fabiana_22k_ns",
      language_version: "1.155",
      voice_dir: "hqm-ref-Italian-Fabiana-22khz"
    },
    {
      voice_id: "acap:Vittorio", size: 134,
      locale: "it_IT", gender: "m", age: "adult",
      voice_dir_v2018: null,
      ref_id: "iti_vittorio_22k_ns",
      language_version: "1.155",
      voice_dir: "hqm-ref-Italian-Vittorio-22khz"
    },
    {
      voice_id: "acap:Sakura", size: 64,
      locale: "ja-JP", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Japanese-Sakura-22khz",
      ref_id: "ja_jp_sakura_22k_ns",
      language_version: "1.43",
      voice_dir: "hqm-ref-Japanese-Sakura-22khz"
    },
    {
      voice_id: "acap:Minji", size: 77,
      locale: "ko-KR", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Korean-minji-22khz",
      ref_id: "ko_kr_minji_22k_ns",
      language_version: "1.30",
      voice_dir: "hqm-ref-Korean-minji-22khz"
    },
    {
      voice_id: "acap:Lulu", size: 73,
      locale: "zh", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-MandarinChinese-Lulu-22khz",
      ref_id: "zh_cn_lulu_22k_ns",
      language_version: "1.33",
      voice_dir: "hqm-ref-MandarinChinese-Lulu-22khz"
    },
    {
      voice_id: "acap:Bente", size: 90,
      locale: "nn-NO", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Norwegian-Bente-22khz",
      ref_id: "non_bente_22k_ns",
      language_version: "1.119",
      voice_dir: "hqm-ref-Norwegian-Bente-22khz"
    },
    {
      voice_id: "acap:Kari", size: 97,
      locale: "nn-NO", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Norwegian-Kari-22khz",
      ref_id: "non_kari_22k_ns",
      language_version: "1.119",
      voice_dir: "hqm-ref-Norwegian-Kari-22khz"
    },
    {
      voice_id: "acap:Olav", size: 82,
      locale: "nn-NO", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Norwegian-Olav-22khz",
      ref_id: "non_olav_22k_ns",
      language_version: "1.119",
      voice_dir: "hqm-ref-Norwegian-Olav-22khz"
    },
    {
      voice_id: "acap:Ania", size: 99,
      locale: "pl-PL", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Polish-ania-22khz",
      ref_id: "pop_ania_22k_ns",
      language_version: "1.96",
      voice_dir: "hqm-ref-Polish-ania-22khz"
    },
    {
      voice_id: "acap:Monika", size: 59,
      locale: "pl-PL", gender: "f", age: "adult",
      voice_dir_v2018: null,
      ref_id: "pop_monika_22k_ns",
      language_version: "1.96",
      voice_dir: "hqm-ref-Polish-monika-22khz"
    },
    {
      voice_id: "acap:Celia", size: 72,
      locale: "pt-PT", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Portuguese-Celia-22khz",
      ref_id: "poe_celia_22k_ns",
      language_version: "1.95",
      voice_dir: "hqm-ref-Portuguese-Celia-22khz"
    },
    {
      voice_id: "acap:Aloyna", size: 77,
      locale: "ru-RU", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Russian-Alyona-22khz",
      ref_id: "rur_alyona_22k_ns",
      language_version: "1.121",
      voice_dir: "hqm-ref-Russian-Alyona-22khz"
    },
    {
      voice_id: "acap:Mia", size: 61,
      locale: "sv", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Scanian-Mia-22khz",
      ref_id: "sc_se_mia_22k_ns",
      language_version: "1.54",
      voice_dir: "hqm-ref-Scanian-Mia-22khz"
    },
    {
      voice_id: "acap:Rhona", size: 79,
      locale: "en-GD", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-ScottishEnglish-rhona-22khz",
      ref_id: "en_sct_rhona_22k_ns",
      language_version: "1.23",
      voice_dir: "hqm-ref-ScottishEnglish-rhona-22khz"
    },
    {
      voice_id: "acap:Antonio", size: 78,
      locale: "es-ES", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Spanish-Antonio-22khz",
      ref_id: "sps_antonio_22k_ns",
      language_version: "1.178",
      voice_dir: "hqm-ref-Spanish-Antonio-22khz"
    },
    {
      voice_id: "acap:Ines", size: 76,
      locale: "es-ES", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Spanish-Ines-22khz",
      ref_id: "sps_ines_22k_ns",
      language_version: "1.178",
      voice_dir: "hqm-ref-Spanish-Ines-22khz"
    },
    {
      voice_id: "acap:Maria", size: 57,
      locale: "es-ES", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Spanish-Maria-22khz",
      ref_id: "sps_maria_22k_ns",
      language_version: "1.178",
      voice_dir: "hqm-ref-Spanish-Maria-22khz"
    },
    {
      voice_id: "acap:Elin", size: 117,
      locale: "sv-SE", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Swedish-Elin-22khz",
      ref_id: "sws_elin_22k_ns",
      language_version: "1.127",
      voice_dir: "hqm-ref-Swedish-Elin-22khz"
    },
    {
      voice_id: "acap:Emil", size: 104,
      locale: "sv-SE", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Swedish-Emil-22khz",
      ref_id: "sws_emil_22k_ns",
      language_version: "1.127",
      voice_dir: "hqm-ref-Swedish-Emil-22khz"
    },
    {
      voice_id: "acap:Emma", size: 126,
      locale: "sv-SE", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Swedish-Emma-22khz",
      ref_id: "sws_emma_22k_ns",
      language_version: "1.127",
      voice_dir: "hqm-ref-Swedish-Emma-22khz"
    },
    {
      voice_id: "acap:Erik", size: 101,
      locale: "sv-SE", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-Swedish-Erik-22khz",
      ref_id: "sws_erik_22k_ns",
      language_version: "1.127",
      voice_dir: "hqm-ref-Swedish-Erik-22khz"
    },
    {
      voice_id: "acap:Ipek", size: 66,
      locale: "tr-TR", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-Turkish-Ipek-22khz",
      ref_id: "tut_ipek_22k_ns",
      language_version: "1.111",
      voice_dir: "hqm-ref-Turkish-Ipek-22khz"
    },
    {
      voice_id: "acap:Rodrigo", size: 67,
      locale: "es-US", gender: "m", age: "adult",
      voice_dir_v2018: "hqm-ref-USSpanish-Rodrigo-22khz",
      ref_id: "spu_rodrigo_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USSpanish-Rodrigo-22khz"
    },
    {
      voice_id: "acap:Rosa", size: 76,
      locale: "es-US", gender: "f", age: "adult",
      voice_dir_v2018: "hqm-ref-USSpanish-Rosa-22khz",
      ref_id: "spu_rosa_22k_ns",
      language_version: "1.288",
      voice_dir: "hqm-ref-USSpanish-Rosa-22khz"
    },
  ]
});

export default voices;
