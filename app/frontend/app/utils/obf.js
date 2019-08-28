import Ember from 'ember';
import EmberObject from '@ember/object';
import CoughDrop from '../app';
import app_state from './app_state';
import speecher from './speecher';
import { later as runLater } from '@ember/runloop';

var handlers = {};
var obf = EmberObject.extend({
  parse: function(json) {
    var board = CoughDrop.store.createRecord('board');
    board.set('local_only', true);
    var hash = JSON.parse(json);
    var buttons = [];
    board.set('grid', hash['grid']);
    board.set('id', 'b123'); // TODO: ...
    board.set('permissions', {view: true});
    board.set('background_image_url', hash['background_image_url']);
    board.set('background_position', hash['background_position']);
    board.set('background_text', hash['background_text']);
    board.set('background_prompt', hash['background_prompt']);

    board.set('hide_empty', true);
    board.key = "obf/whatever"; // TODO: ...
    var image_urls = {};
    var sound_urls = {};
    var buttons = [];
    (hash['buttons'] || []).forEach(function(b) {
      var img = b.image_id && hash['images'].find(function(i) { return i.id == b.image_id; });
      if(img) { image_urls[b.image_id] = img.url; }
      var snd = b.sound_id && hash['sounds'].find(function(s) { return s.id == b.sound_id; });
      if(snd) { sound_urls[b.sound_id] = snd.url; }
      buttons.push(b);
      // TODO: include attributions somewhere
    });
    board.set('buttons', buttons);
    board.set('image_urls', image_urls);
    board.set('sound_urls', sound_urls);
    return board;
  },
  register: function(prefix, render) {
    handlers[prefix] = render;
  },
  lookup: function(key) {
    for(var prefix in handlers) {
      var re = new RegExp("^" + prefix);
      if(key.match(re)) {
        var opts = handlers[prefix](key);
        var board = obf.parse(opts.json);
        board.set('rendered', (new Date()).getTime());
        if(opts.handler) {
          board.set('button_handler', opts.handler);
        }
        return board;
      }
    }
    return null;
  },
  shell: function(rows, columns) {
    var grid = [];
    for(var idx = 0; idx < rows; idx++) {
      var row = [];
      for(var jdx = 0; jdx < columns; jdx++) {
        row.push(null);
      }
      grid.push(row);
    }
    var shell = {
      format: 'open-board-0.1',
      license: {type: 'private'},
      buttons: [],
      grid: {
        rows: rows,
        columns: columns,
        order: grid
      },
      images: [],
      sounds: []
    };
    shell.id_index = 0;
    shell.to_json = function() {
      return JSON.stringify(shell, 2);
    };
    shell.add_button = function(button, row, col) {
      button.id = button.id || "btn_" + (++shell.id_index);
      if(button.image) {
        var img = Object.assign({}, button.image);
        img.id = "img_" + (++shell.id_index);
        shell.images.push(img);
        button.image_id = img.id;
        delete button['image'];
      }
      if(button.sound) {
        var snd = Object.assign({}, button.sound);
        snd.id = "snd_" + (++shell.id_index);
        shell.sounds.push(snd);
        button.sound_id = snd.id;
        delete button['sound'];
      }
      shell.buttons.push(button);
      if(row >= 0 && col >= 0 && row < shell.grid.rows && col < shell.grid.columns) {
        if(!shell.grid.order[row][col]) {
          shell.grid.order[row][col] = button.id;
        }
      }
    };
    return shell;
  }
}).create();

var assessment = {};
var mastery_cutoff = 0.75;
var non_mastery_cutoff = 0.32;
var attempt_minimum = 2;
var attempt_maximum = 8;
var levels = [
  // TODO: best way to assess different symbol libraries
  // TODO: ensure you are checking/tracking range of access
  [
    {intro: 'intro'},
  ],[
    {intro: 'find_target'},
    {id: 'find-2', rows: 1, cols: 2, distractors: false, min_attempts: 1},
    {id: 'find-3', rows: 1, cols: 3, distractors: false, min_attempts: 1},
    {id: 'find-4', rows: 1, cols: 4, distractors: false},
    {id: 'find-8', rows: 2, cols: 4, distractors: false},
    {id: 'find-15', rows: 3, cols: 5, distractors: false},
    {id: 'find-12-24', rows: 4, cols: 6, distractors: false, spacing: 2},
    {id: 'find-24', rows: 4, cols: 6, distractors: false},
    {id: 'find-20-60', rows: 6, cols: 10, distractors: false, spacing: 3},
    {id: 'find-30-60', rows: 6, cols: 10, distractors: false, spacing: 2},
    {id: 'find-60', rows: 6, cols: 10, distractors: false, min_attempts: 4},
    {id: 'find-28-112', rows: 8, cols: 14, distractors: false, spacing: 4},
    {id: 'find-56-112', rows: 8, cols: 14, distractors: false, spacing: 2},
    {id: 'find-112', rows: 8, cols: 14, distractors: false, min_attempts: 4},
  ], [
    {intro: 'diff_target'},
    {id: 'diff-2', rows: 1, cols: 2, distractors: true, min_attempts: 1},
    {id: 'diff-3', rows: 1, cols: 3, distractors: true, min_attempts: 1},
    {id: 'diff-4', rows: 1, cols: 4, distractors: true},
    {id: 'diff-8', rows: 2, cols: 4, distractors: true},
    {id: 'diff-15', rows: 3, cols: 5, distractors: true},
    {id: 'diff-12-24', rows: 4, cols: 6, distractors: true, spacing: 2},
    {id: 'diff-24', rows: 4, cols: 6, distractors: true},
    {id: 'diff-20-60', rows: 6, cols: 10, distractors: true, spacing: 3},
    {id: 'diff-30-60', rows: 6, cols: 10, distractors: true, spacing: 2},
    {id: 'diff-60', rows: 6, cols: 10, distractors: true},
    {id: 'diff-28-112', rows: 8, cols: 14, distractors: true, spacing: 4},
    {id: 'diff-56-112', rows: 8, cols: 14, distractors: true, spacing: 2},
    {id: 'diff-112-112', rows: 8, cols: 14, distractors: true},
  ], 
  // at this point, settle on a grid size that the user was 
  // really good with, maybe try occasionally bumping a little,
  // or slipping back down if they're not succeeding
  // (min of 3, max of, say, 15)
  [
    {intro: 'symbols'},
    {id: 'symbols-photos', symbols: 'photos', min_attempts: 3},
    {id: 'symbols-opensymbols', symbols: 'opensymbols', min_attempts: 3},
    {id: 'symbols-emoji', symbols: 'twemoji', min_attempts: 3},
//    {id: 'symbols-noun-project', symbols: 'noun-project', contrast: true, min_attempts: 3},
    {id: 'symbols-pcs', symbols: 'pcs', contrast: true, min_attempts: 3},
    {id: 'symbols-pcs-hc', symbols: 'pcs_hc', contrast: true, min_attempts: 3},
    {id: 'symbols-lessonpix', symbols: 'lessonpix', min_attempts: 3}
  ],[
    {intro: 'range'},
    {id: 'range', all_range: true}
  ],[
    {intro: 'core'} // grid of core words, find (with symbols)
  ], [
    {intro: 'literacy'} // grid of words without symbols
  ], [
    {intro: 'open_ended'}, // open-ended commenary on pictures, only up to observed proficiency level
    {id: 'open_24', rows: 4, cols: 6, prompts: [

    ]},
    {id: 'open_60', rows: 6, cols: 10, prompts: [

    ]},
    {id: 'open_112', rows: 8, cols: 14, prompts: [

    ]},
    {id: 'open_keyboard', rows: 6, cols: 10, prompts: [

    ]}
  ]
];
var words = [
  {label: 'cat', type: 'noun', category: 'pet', urls: {'lessonpix': 'https://lessonpix.com/drawings/615/150x150/615.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31952/99ab9aad60e2ba06eb200101fe6eb91165f673a4549d16033f3e2ad73ede8c09138f95ea2898b75a7bba0a9b28a8228f9d22e842674fee6d1d679df7bb9f3362/31952.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02069/d98a15eaf38e0b3e4ecba299a035076e6d29fc0c6b5a5869ee28531fe33b5942e12408da6c0be984af162c23f12b0acb359d4741b14f0680d8ee69b2525d4f5a/02069.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f431.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/cat.png'}},
  {label: 'dog', type: 'noun', category: 'pet', urls: {'lessonpix': 'https://lessonpix.com/drawings/1645/150x150/1645.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31958/c08ca81f4615aa3bcc2f3423b3afd7785353b422edb3ff2738b7cdf4f433b7bd22c193a1e42e7decbd10b0d7fbb661c2615d7e145eddcaace2f31b512096dfe5/31958.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02078/062c66b181bf245aaaa9bb4f70e88db14f330feb43ea006c606a0c7d3344a5b2d6ebd7aeac891fec8f2f3a16bb0faaebb763c6b07bd12a825bd5968a44ac5fdd/02078.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f436.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/dog.png'}},
  {label: 'fish', type: 'noun', category: 'pet', urls: {'lessonpix': 'https://lessonpix.com/drawings/5374/150x150/5374.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31961/b36b386465a44eb53c2aad54ff2c55bb34720b7a125cfd13db584431756545dc1048c53d82318f0fd63f88eed64fe0f2cca517cb232039c57c9a18875a7fdc19/31961.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/05016/f81c87be259044eaaa38616b3b392d2311af8d2e28b592319bb26bd75c480f0c3513dc4d4e06fca67a1453c2b03844b90daf0e4c289b8e643e2b9ab063f049d8/05016.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f41f.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/fish.svg'}},
  {label: 'rabbit', type: 'noun', category: 'pet', urls: {'lessonpix': 'https://lessonpix.com/drawings/1727/150x150/1727.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31978/322dcdf62cc9847946594515975f4dcbf333c957d10067423f596c09f77900ebd2776bac2d80fd5413ea37eef1eff07128ee606feb2779d502be29aff39d03df/31978.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02110/27c691483f026fa388de5ba9b454c221bc978cd6ebba43c7a3b9d70228a05bf2b045517d79fe06308924f6beefdd40893429961fe2b65461f076b212767d332b/02110.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f430.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/rabbit.png'}},
  {label: 'lizard', type: 'noun', category: 'pet', urls: {'lessonpix': 'https://lessonpix.com/drawings/9480/150x150/9480.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31972/8d723a14cb15475c9d2ff9196827a5cb83f40e877587981468c0864aa9c759867c1ce8dc7888cc28d3717c9a68e51e4ebe63ba9a5291221cee6a59b68a415c97/31972.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/06018/7a8818e5d8573609bec75c746955430760a1a5137e1627f69c338d1a4b03e1627b3ab8b21e1e2b6b4157323fda7de4f80375cfa0132d6d9bf7aa6141e60c1de8/06018.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f98e.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/lizard.png'}},
  {label: 'hamster', type: 'noun', category: 'pet', urls: {'lessonpix': 'https://lessonpix.com/drawings/1292/150x150/1292.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31967/d6393eb441633057c158c3ad82e5360ad1125ea5c4a9118136259394c9ee54f00ca18921bacf3dd84d6b7bc1ae915c2270b37f4dcba59524f0c6040b0d33e166/31967.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02093/9dccf60c281243389d1ae134ef988d0d94fc16e53e72a54b2d3c3fd95a2ee23c24430057eb6686196e82818ebb613ac2a8cc631fb3714c3d9bdb0913046b3a29/02093.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f439.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/hamster.png'}},
  {label: 'bird', type: 'noun', category: 'pet', urls: {'lessonpix': 'https://lessonpix.com/drawings/1208/150x150/1208.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31948/f7159824c5bfe6ce41a2f687a65eb5c2bc7ec15c74bfddaabf8a4208b5cee8ca0b9976a627e203717077e6a03ca8f3bb3016ba630b65e48b79f17ea967e8f705/31948.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02063/c0d39867031dc6f7aad62a1c5da45f615e1c558617e7e761d8c6d97824f48b3c8523ab978e6dafd1637a85dd3a887a04a0e93f801f2e43720e54168aae97c5ae/02063.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f426.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/bird.png'}},
  {label: 'snake', type: 'noun', category: 'pet', urls: {'lessonpix': 'https://lessonpix.com/drawings/688/150x150/688.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31982/cdf98136f8253b25d0b2d623fbddeba00d2125b66425eea75c43aff8ff1791d1f309f5cf5aed9434fdda30a1b077fbd1c22f76ea9427b346a1a096ce306fcf05/31982.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02117/03d072ca45f5d93c394de6689ec4169e5207ba028d9ca2c02496b62dfaf1803a40968007cda922f4a748c22ac39cd1d81bf023bbbc8ab4e36adc6653827e2b3b/02117.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f40d.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/snake.png'}},
  {label: 'apple', type: 'noun', category: 'fruit', urls: {'lessonpix': 'https://lessonpix.com/drawings/443/150x150/443.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31645/b3b1d56bf64ebbb1dc5ce272a0217919fcafc92acae8c6de787a0488e7bd0dd40728b4979dc2507e6291548993f801a845f32098cc6a90694a8a731e0fc8937d/31645.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00551/002ea858bd90350542a16f0e2346e4a84c72cc8c8a5bcc045647788465739607a7ef344dab5f8d9659ffa4fd2f7413334d4891f64700c0c3699f07ca30e00238/00551.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f34e.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/apple_2.png'}},
  {label: 'peach', type: 'noun', category: 'fruit', urls: {'lessonpix': 'https://lessonpix.com/drawings/635/150x150/635.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00562/f2ae05ef99ee193735b9bd547880a894ff94b4e9cefcccf240513baa0f864a6534f7d95819f5fa7fedec6dff51ec59d5c88979ed72257104af9cbc5719943d4a/00562.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00562/f2ae05ef99ee193735b9bd547880a894ff94b4e9cefcccf240513baa0f864a6534f7d95819f5fa7fedec6dff51ec59d5c88979ed72257104af9cbc5719943d4a/00562.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f351.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f351.svg'}},
  {label: 'grapes', type: 'noun', category: 'fruit', urls: {'lessonpix': 'https://lessonpix.com/drawings/447/150x150/447.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31649/f3868ef267723a6e4bc7a1ec830692637f300d49cd786d15386f274c3792679735bad4218aee3cbfb788b2ca9baaf2d5604506ea15bd4bce44bee1f6d73eb8c9/31649.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/12305/4c22e5b76632fb77798825859c6cf6053abff1bcfd2178a0f1446586e744ae7e3b5e80e39cc2cac20835b3a0552960a392f9756fa45b1f176fce88358111ecd3/12305.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f347.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f347.svg'}},
  {label: 'pear', type: 'noun', category: 'fruit', urls: {'lessonpix': 'https://lessonpix.com/drawings/636/150x150/636.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31652/81e8c5590fdbbf970de4310007aa838acd7b8d9bdffa9be3434e61116d061db48c75311ac795125189c97d152ca8627bb8a5bbf96c2ff1116a5203cdab724b08/31652.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00563/96356933db7d71e653c960e8143400d2d9e3f70724c48df93fabc3e2e3368080a788d232bcb49e73ce61349b2acf7ec57bbbb82c7ccad9ef980e6f34ad4d85fa/00563.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f350.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f350.svg'}},
  {label: 'banana', type: 'noun', category: 'fruit', urls: {'lessonpix': 'https://lessonpix.com/drawings/445/150x150/445.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31646/ff54cd3040bf0797d451a5b4b104e1a9e2853348756e025e69609a2297a8706eb87d6f5eff81a8a3cd4a5b7120b298668ec8d62a7a42f77147424909efbec263/31646.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00554/6cb78c114f5c5baa6c8d8f30ae10aaaaa031d3b85a2be0aa19254c65c8676cdb4e0cc612987e8c51697e807cc6dcbb12b09ad3e77c1a2bbbf379fe8b4898ac61/00554.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f34c.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f34c.svg'}},
  {label: 'strawberry', type: 'noun', category: 'fruit', urls: {'lessonpix': 'https://lessonpix.com/drawings/2889/150x150/2889.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31653/d55dd62877154f5fdd97409c2430a93ef4b2ff11ae8641dd4b26ec49107f1d6f347094d83ed1f92318d2227f3dcbee9e355508b3497b95866928d3275d241b2c/31653.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00566/924d89a1b9aae45a76ffdb55c1631621dfefaee7eaef5f621ee2f7fe16698b721257a460f0b77cd4345f806833f673c7655e3cea3d5cb80e1213a15a7cf313d8/00566.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f353.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/strawberry.png'}},
  {label: 'blueberry', type: 'noun', category: 'fruit', urls: {'lessonpix': 'https://lessonpix.com/drawings/117238/150x150/117238.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31653/d55dd62877154f5fdd97409c2430a93ef4b2ff11ae8641dd4b26ec49107f1d6f347094d83ed1f92318d2227f3dcbee9e355508b3497b95866928d3275d241b2c/31653.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/06357/133f630fda75dd304ff327e9bf30c4fc824922e4d68ab01e5f67c97e118424c614e043aaef922ef8967d01d1ff4af88e4a414d62e8e52a79cbe9ba10da1c7db0/06357.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f535.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/blueberry.png'}},
  {label: 'cherry', type: 'noun', category: 'fruit', urls: {'lessonpix': 'https://lessonpix.com/drawings/1451/150x150/1451.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/55973/3138c07c16104de10b02704699e37d46141f28e9e3e7ca2e63f4584431163b50f2ce675440ae2b6e2b13b2988a8e549870f915cf37ff85a7a78f5d00a3451dac/55973.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00555/e526c0eef3c7d8489a76f3d4d25b19898b7fc9cc314f5753de6710fe8c4ab746529d8b54372fcbbe37fafba21a87d1351172c5c2902bb7587c977e52476ac4e2/00555.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f352.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f352.svg'}},
  {label: 'car', type: 'noun', category: 'vehicle', urls: {'lessonpix': 'https://lessonpix.com/drawings/579/150x150/579.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32003/27e969f656e5ef9d230977b33a29cbca94c30f50567916b6475a54f5428cac34a75e22f6517004b42bfeb6dbab5e79266b767e73bf3e3e663989fa821a31ac3a/32003.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02245/068cb574cf97186ac15e17c5fabf807db3d9d07459a063348eb5bfb4e8d0440b3423c76bb43985026a21a29647f115e4a59872a951fda3d2e1d5470c4556f726/02245.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f697.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/car.png'}},
  {label: 'truck', type: 'noun', category: 'vehicle', urls: {'lessonpix': 'https://lessonpix.com/drawings/1316/150x150/1316.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32013/ff8d531315cb44f06cab0a0b2b7df54bfbe0bca633f5ed96d99cddbd909e382137dd34c45441d7d5fea2e0dfc1a8d5c97d793391db7f572fa5ee1b65663ab7de/32013.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02267/2d1ffa37839d89aa550bf6587872183295cfda128a3aac54698e23e94cfaa278f5aeb54f56e270cb1d9c33df9b60c7604e083f13c1f446864b3e4a7fa29a36e6/02267.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f69b.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/truck.png'}},
  {label: 'airplane', type: 'noun', category: 'vehicle', urls: {'lessonpix': 'https://lessonpix.com/drawings/470808/150x150/470808.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31998/7f88cef3ec8280887f30897410413e73ed16a3a586ec6e453543cecbd3cb2de9c542aed2a933c29f70f0cd17a629c84afd55a917a1efcff9ae47d9b0d9771a7a/31998.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02240/2b8ce9d2709f7818c17e8ef39d0deb196a30e8a6a95d47340a7a5a88c2ecd973ea7ff321137a5e986752695aa7f85c6723cb824eaae8cf4180d8a73cb3f8c620/02240.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2708.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/aeroplane_1.png'}},
  {label: 'motorcycle', type: 'noun', category: 'vehicle', urls: {'lessonpix': 'https://lessonpix.com/drawings/3667/150x150/3667.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32006/a7060d5dfd52c90c4c39b9b95ec82084f03a7d86caa8ce8fdb18510787e65697f94a140b0129efe060f5462ba3de5cd028ee748c22520ba529e97a21ab0813e5/32006.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02253/51c0ec862a7fa9447b78d29e07162562e5f6046b7d0d6f7795da71c4dda98e1403fda43830cdc425ec769278145a69053dd927067e479d1f8fb8ce052e3da0f9/02253.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f3cd.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/motorbike_2.png'}},
  {label: 'train', type: 'noun', category: 'vehicle', urls: {'lessonpix': 'https://lessonpix.com/drawings/558/150x150/558.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32012/e583384e4339bb4e85f79f278aa5dd1d7b6982db712dac7864e47212ad4df4ea2f9fedcd52b61a5628606dcf331514d0092b5bc362b77ba5411ea0d890a37b6f/32012.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02265/7234c0094aa6e9bcd7b41f8893647636d682d6f675cdc22e5964783efb196eba204e99ecdcb1f5bc6519a40d9afb4b17ba3d34b2cce6bd9f8cf3e79c2ca4b70d/02265.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f689.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/steam%20train.svg'}},
  {label: 'bus', type: 'noun', category: 'vehicle', urls: {'lessonpix': 'https://lessonpix.com/drawings/1181/150x150/1181.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32779/70324a46034417f89e393e9e791e27ff893770ac1823f5c2a7dd0f50fe3a6549f69f7794a23cd8091990f88cd2a09a7339c6bc8cd429a73e0ef2bd2e5a7917ed/32779.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/07121/09a1647651d7a5814c7456966bf9e84c85708c07fa9a6d25e565d8b3431da1669b994ed7042efaecb83fb1bf6b9d0afccec70cba2a2ce6fdfc70e3fbd306b682/07121.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f68d.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/bus.svg'}},
  {label: 'van', type: 'noun', category: 'vehicle', urls: {'lessonpix': 'https://lessonpix.com/drawings/1328/150x150/1328.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32778/919b9e53f1756b50813630b0b362be8dd8bcb419fb2541349a6d5b6895bc3485861362521579de15c0e60da21ced184a874f81992ca312cc2e283983bfa3cf2f/32778.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/08328/1921d41d6edd382a5d1436ad6f1b3167791edba5ab9d3fb0009e3722c95515ee64ba05d3782a2b5729e22c268daccd2fde39c481dffac485e58974a4b0c44ade/08328.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f68c.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/van_1.png'}},
  {label: 'tractor', type: 'noun', category: 'vehicle', urls: {'lessonpix': 'https://lessonpix.com/drawings/1856/150x150/1856.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32011/f53770ee124e9bbc5e090d343e0de5d08d03a3475ef680fdc169de9c632020078229b44390d8c46df0f4c02b514d197069f727ddfd051468765a3ed1cd25b933/32011.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/02263/32a5c8d4641a5e48d894e1a9d99aad9d5a09f74e09c3dc7f6c01431b9a572ab08b389175e165646bb0e9e223d1557b174d373f1973d16f206223b1a930436302/02263.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f69c.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/tractor.png'}},
  {label: 'eat', type: 'verb', category: 'action', urls: {'lessonpix': 'https://lessonpix.com/drawings/1978/150x150/1978.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32126/caae2bacf734adb746746759eb5a68ab60cffa53e26899a09331e025e5d69f9e42422496cf1e9c6f284d00bba438fd179fd58296044a5435b81e00ae8ca62476/32126.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03142/b3f72f92f65dcb3e336004dd3094658457f47cc1bcac48f8182956a98c7670cc4d40b0c00f3c4ec014321329a3905a6af5ad40c7ecc478f499dde2512301310f/03142.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f35f.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20eat_1.png'}},
  {label: 'drink', type: 'verb', category: 'action', urls: {'lessonpix': 'https://lessonpix.com/drawings/1975/150x150/1975.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31632/15d18dc60bf29c10b4ac5ca099a67a2d5bf6c94468a9372ff4a759a429d33ebd7f5f3935a973c914a227531da49341e29eac8aa95718c42b70192d4ea1910a74/31632.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03564/bb9141078b228976361f14094e2c08372b11ccdefd3b00d5c9953ca849a3778c6e22bc119edf2afcc3d05d9c8b6f673733f5a8b6a1db63f7383c1cae739e4c51/03564.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f379.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20drink.png'}},
  {label: 'run', type: 'verb', category: 'action', urls: {'lessonpix': 'https://lessonpix.com/drawings/645/150x150/645.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32239/60575a84c46deddb899df9cf3d114cede7d98962a478bab4ef4c58a4b97242174379cf2329e23f351bbf4342cfd7e7c63643cb405726df363a3db1ef8b1988b4/32239.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03365/39bc60797310db4077a1b638356390d6c2be4596806c5eaf83633bd40bb6f72809ff3eab01cd8546a9d57ce3b6ada4a3a64a45489289a46c2a87b99a2d2de999/03365.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f3c3-1f3ff.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20run_4.png'}},
  {label: 'jump', type: 'verb', category: 'action', urls: {'lessonpix': 'https://lessonpix.com/drawings/478/150x150/478.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32212/354c53105150fad541a214f8244865878409e859737c260630501c52b8a6ec90eae1faedc0b166061969074bd3eb96fea00a1a63eb8f07cac3bdc017eca45070/32212.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03225/27ca0c523906b3185b4f9433863bf84c1fd9fbe0ee91746b892d9157d89b56591cb8e98c60fbee421da63d86ecf5bc9bdcd1516bc9cf4a0619565bc24d8f6b15/03225.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f93e-1f3fd.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/jump.png'}},
  {label: 'sleep', type: 'verb', category: 'action', urls: {'lessonpix': 'https://lessonpix.com/drawings/656/150x150/656.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32680/68079bc4363775d880142823ff73b76055ad67e3d5705b24005190e1738340e6ed5411c1d1efb7d63a0bfb2409e0f558964151c9213c5110aed93d108674e7d3/32680.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03397/ff62337dc76a373ba6305712c2d359c60ca786d9d78f3ee128a03a32a23655bb034525a3e58be22fd875f23d8b1d0f537293875b07ce1a753057005528af7044/03397.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f6cc-1f3fb.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20sleep_2.png'}},
  {label: 'play', type: 'verb', category: 'action', urls: {'lessonpix': 'https://lessonpix.com/drawings/2024/150x150/2024.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32227/248b2b8d653a6bfbfdb40f0aad2dd40ada065a6eb27f421127b824bebd27d748a6e6353fe0325b9be51d77aa3d0cd27dad2dd2202fd54bf96891f37ed6f0bff9/32227.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03684/308b02dd58660755de543301936ec42bb25d0960d51487de693ed8827dcac626f25771a305546eedb3160f1a7f3d6eaca84bb9ba23613a8add7c56759fa7d938/03684.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f938.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/tawasol/Play.png'}},
  {label: 'climb', type: 'verb', category: 'action', urls: {'lessonpix': 'https://lessonpix.com/drawings/13084/150x150/13084.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32190/cf29dcc08a8161c556f65f3d41b80cce887b279f48e707fbbe8de521f3d4401d0ca579c0d94b8f000cab1bd701d35a0770176bb904c5be273722970f8a7249fe/32190.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03097/c8108d97527c4aaadac465936e2ccb8765f4a8a0812619c79da780bf1a7bd61e50e979f60c30f83a4c7fdd12e0379c61f63fe49f236c4f1d436230d59c092a38/03097.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f9d7-1f3fd-200d-2642-fe0f.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20climb_5.png'}},
  {label: 'push', type: 'verb', category: 'action', urls: {'lessonpix': 'https://lessonpix.com/drawings/641/150x150/641.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32230/02e336e3e907008ede55b7ca9711eb421d18138c5dcf7eac9cd615916765f0a813086d52af0bec96df4a681dd7bddfe0aea74517118a6fb4f16cecc9642d6ce0/32230.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03328/58733d4eee6cd6c51d58a3d410800e93b988af77c8098b04a8a905b4906b3c3a0b3117d9053e78b2ea31345352b741c7ce822f3ef2a94844aaeebc29b0889e98/03328.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f6d2.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/push_5.png'}},
  {label: 'happy', type: 'adjective', category: 'feeling', urls: {'lessonpix': 'https://lessonpix.com/drawings/13748/150x150/13748.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31517/ba0f40648afbeeb045cc688bd2227a4abd7e23791d2b0c40e83b542179336a356990260267d4197f235632cc535694263d8bfe81ed4a03e13f1a6551eb670e94/31517.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00047/5fc50fd308c61df38e26e426845a6c055b9b900f2fec0936f916bf104172ab020da82c0a598c7df0d834310223644d93ffb2e802e0df75b6a6c0dcb61a6fe3f0/00047.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f60a.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/happy.png'}},
  {label: 'sad', type: 'adjective', category: 'feeling', urls: {'lessonpix': 'https://lessonpix.com/drawings/1695/150x150/1695.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31523/09217e95b98a9b56a119d509f1e3f04c4f9d30d9af5ac32438121bdfaeef0f15792b0403bc249e595b1e60a59a6dee6976959c8ee5c47145daff9f97f12591a0/31523.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00075/5447142ec6f3342a1940d988c325d3bbf1e02cebd54c947d93759caf0a3a49bb36d7ff13a25092327a027cf88619c5fabf6e0f281b45a3bfa63b4f14e7d76cb1/00075.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f622.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/sad.png'}},
  {label: 'angry', type: 'adjective', category: 'feeling', urls: {'lessonpix': 'https://lessonpix.com/drawings/124/150x150/124.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31521/02f7bb91e06f39f8eb31e02f5faec0d9f81d2c8b3fe64ddc15e0e1f97bbb935c35fb91b6d3431e66e86a0f550f0296e68d363182542778344650cd319dbe9209/31521.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00067/e0afb1eb5daa9550ca7bf2a2b1d8e695f9c375cb1477d13e8c83aaf0d7183c7c276ff711a5518cfe1a64d7bdf2af9200618f5a7dfe1c7fae6b702c18051c28a6/00067.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f621.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/angry.png'}},
  {label: 'surprised', type: 'adjective', category: 'feeling', urls: {'lessonpix': 'https://lessonpix.com/drawings/1701/150x150/1701.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31526/36bffac158fcc53f75aa0dfb6a2c0b83901d21da5371da2018cc5d158e4a127cbd14ca92212515ef8fd858552e199a67a6fd70943bd64609258d2b124ae5f9d1/31526.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00085/dbdf67515134145ca01b09f9c4402df6993b32fe0d151afc95c7e55c01b9afe312b8050cbc25b1807348afa86834661b9522fa8b76e3464844d214485655c07c/00085.svg  ', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f633.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/surprised.png'}},
  {label: 'confused', type: 'adjective', category: 'feeling', urls: {'lessonpix': 'https://lessonpix.com/drawings/1782/150x150/1782.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31509/fb7f7fd51af255cd442fd8a8880e14b203189295598c8f375432d07e29a4665f7d033b69c46256d4e8911590cfdfcff30cc6b3be1fabad2350fe47938d7d4311/31509.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00024/6582d8b2789fb8253f988f7ea667b50a0061be3ad9986b7460f6e9f49619b767a4b48435521f8943646bb1b6a4140bc886137a5ac389be158b648be9f3f792d8/00024.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f615.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/confused.png'}},
  {label: 'silly', type: 'adjective', category: 'feeling', urls: {'lessonpix': 'https://lessonpix.com/drawings/33597/150x150/33597.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32494/79b711041cdd057bfbb839c6c9f6563bfb54520905e2637e2b340ffea6342619fe65a4fe7c3a957059599129f4f4cfe337dc31928bd2f6e9497a344f1e863128/32494.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00081/2e433bf8b5c2ef17fcfd4dcc3ba1a7d6eee99582c3b9511a7c9fdddffe40946a9d88c9f0b037044d338083d1f391cb8ea76dea9d52dc9e76be1d74f5335a4545/00081.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f643.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/silly_787_320383.svg'}},
  {label: 'bored', type: 'adjective', category: 'feeling', urls: {'lessonpix': 'https://lessonpix.com/drawings/1697/150x150/1697.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31507/ecb4a645918864c47f5161e2d3d468227fd81e905aea04d1bdf9621d2e74b3fa8a3f73bd1120bb4bab18fb2161f408859161ab9971ee47662963a89e03ebdec1/31507.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00020/571a78b3d6f35444c92ee6579829718766d9714460bddc6ced30bf936e98b3e9ce68f6247a9b56ca9fddf07684dec608112562fac8d1c87eb3bd63c08121e09a/00020.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f4a4.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/boring_2.png'}},
  {label: 'excited', type: 'adjective', category: 'feeling', urls: {'lessonpix': 'https://lessonpix.com/drawings/1689/150x150/1689.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32438/8583ee624b4354bdf922b259c2085ae1a9f3bd3c3feb5dc6ace113e4b5a6a0293ed22d356cf44675250003676946c6359af8938e783df55bc2b9661d4cc09444/32438.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00043/a3eefa7a12103a82dbd943c9a49c9ba6ec5ecb0f0e4834a4938498f67a0ec6b8738c1e24fdc598e87c2acbc4307fd3f49d39f7772a0a7623702f020ca04ce468/00043.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f604.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/excited_927_g.svg'}},
  {label: 'up', type: 'adverb', category: 'direction', urls: {'lessonpix': 'https://lessonpix.com/drawings/557612/150x150/557612.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31691/c3b7d6569ac94b3e9b6975f25e524a888945dddf9bdb0840fe21fb93fad1bfa454587c2f861f39f79ebacd88e66fa8fa4ce5c4bcff5b97a751a02dbcba4946d3/31691.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00662/e0362453334e8cca897d5dc921067b5f64a7b570d83c86bd6b2272bd2e9234ba2013709ccbef20e8729497f56eca7e8889eaeb4e3ed8cbae02e2b6c61ddaf600/00662.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2b06.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/up.svg'}},
  {label: 'down', type: 'adverb', category: 'direction', urls: {'lessonpix': 'https://lessonpix.com/drawings/1042/150x150/1042.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31670/7bf07f6d885a1a44c94edc5642bee4d2153e73b16565639912be6c2be0b09727b696d95cc36a9451ceca3be06c2ee663d84d450c8a077e2d65d7df0c3425df2c/31670.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00611/07c5b3278ec737ca50a00b9789471235c75d19a444623bec891a57357f2fbdf3a309beefc57b0805e77ad98d06ffdaaa1611ee4372c6d2aac015ad7e8a7ff3f3/00611.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2b07.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/down.svg'}},
  {label: 'left', type: 'adverb', category: 'direction', urls: {'lessonpix': 'https://lessonpix.com/drawings/818/150x150/818.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32987/e9dfda2d720fa60d2b8bc95fa5f8e45ba17692afe727f7667870f009a49e3d57e0617519d4b926e0abb0001b7961e1879b073ff3f2efcf97dd9c637513fd7031/32987.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00627/8cb6d9be7f4832283e0f7e20043b7c84abadf2f6d2975dbf9ef55266a49f587aaeeab1a21485cffef7ede5aadbd874966c8d21d16c00b202b6b5bc0f28e91b42/00627.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2b05.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Left_63_g.svg'}},
  {label: 'right', type: 'adverb', category: 'direction', urls: {'lessonpix': 'https://lessonpix.com/drawings/821/150x150/821.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31578/7799f6812aa0f617a6362d52548240cd66f1c249aa0f7e2304181967ff53771cff068a8d34b7d8a0ba0289af260b5d6f6d1f1cad1ba1c2f9a9406f876006f87c/31578.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00643/7a8c24079a026e1d2a4b832a66d064f06bcbe5b561fd66717583170f2b02f921959e47f9c4cdec0b80dd5bd5a91f34aaf6b9943bd8aab615e52c6f7ab06a3b73/00643.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/27a1.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/right_854_g.svg'}},
  {label: 'in', type: 'adverb', category: 'direction', urls: {'lessonpix': 'https://lessonpix.com/drawings/31874/150x150/31874.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31673/6938f04a954c2e8078a6d0d88561154e14a7d7f5bc31bb491a600cfd6be8a6f3741df4240c01c5b35cfbb601ce62f9d4e1898bea532d7c514d797bc79d4568be/31673.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00623/e6fbfbeef3f2e3652fe2575fe9871d55fed3b4d9e6636f7512f5b286007f5870b8c42db7c7a2c0afc304660bb6a101b32a8d1ce72d521793ad1c07e9c6d598fa/00623.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/26f3.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/in.svg'}},
  {label: 'out', type: 'adverb', category: 'direction', urls: {'lessonpix': 'https://lessonpix.com/drawings/31883/150x150/31883.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31680/5491115ee1b4dedc3e95e4e362612bd40d8427bf29eee20ae12df0ba4f82d3f3f206305e6f4c914cae7dfdb84c99f3370532b2eb691da1a455048c7b55f3ca1f/31680.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00638/77dc789fe383cad4bd90152f938473be896cb0bcfca2d33a4169549fe0a8ea92d8cde2b9c3902347868e9351490676379f8a7b7e691362120fb1a57ce358edce/00638.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f423.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/out.svg'}},
  {label: 'over', type: 'adverb', category: 'direction', urls: {'lessonpix': 'https://lessonpix.com/drawings/31886/150x150/31886.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32374/262fbee916a99cb8103034d16afc9996e02a92db7aeb63c104340b283531ed288925a99fb0110b99ddc05acd890aeb31a5e796ec539fd4ab5db9366083e73ff0/32374.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/07590/491e06987494a0df023ad56db3598c878c47dce03a57a5238fd53f52e79992646e8ed9f762cc72cc799e0be3e6c6403b69ce6526b6e71a5b62664edd43e38842/07590.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f308.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/over.svg'}},
  {label: 'under', type: 'adverb', category: 'direction', urls: {'lessonpix': 'https://lessonpix.com/drawings/31889/150x150/31889.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31690/bd91339dd728bcd4d83ea54c841c2efdeb8fc94c6756c3702689f79463718d408572b4c50cace0f6a78237ec6ca010d28067b4ea833efe3f8d821e56e9942aeb/31690.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00661/948ae17b136e32d0d8074cc76d6f7bdf792ee2b7b07f032b12f1ef350d68f460fbfa7525d366236b5a8204e3bd18bf10ed68b5c0d283fa573179aff88a7339ec/00661.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/26f1.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/under.png'}},
  {label: 'think', type: 'verb', category: 'school', urls: {'lessonpix': 'https://lessonpix.com/drawings/36149/150x150/36149.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32664/d99d0d9a9f9449f866fa6c57ca370f926a8fd0704ebe6d0e0e527d8990fc51736748381e00c42009225b071f191983f03c2bd3a3c7f875d546581e04b7ea0db2/32664.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03446/f324a5f7c232551054707ce4cfcf5224caa41526970f5cc8af2fd3de6c5f9975681aa4335756cc91ea9fe208fe4488e121ef3ebc7675532a42aab1ccae054d9d/03446.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f914.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/think_118_g.svg'}},
  {label: 'write', type: 'verb', category: 'school', urls: {'lessonpix': 'https://lessonpix.com/drawings/638/150x150/638.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32184/7bcb0edb2b9acdd5b28101487900ef84c5379000fd05b5a7fa31043c1d820140e53668aa0d5afaf001195a530b77bbe6fb0a7ac6eb402b85395bee7f5998803f/32184.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03500/be861d4a34aadd2fc39cdbd34a1bf079819d20d9b8f30dca135df35a72a00c765efc0d7d98551bc07aff6611509f78ba2640de31863369ea11da367d33cf7c32/03500.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/270d-1f3fd.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/write.png'}},
  {label: 'wait', type: 'verb', category: 'school', urls: {'lessonpix': 'https://lessonpix.com/drawings/14783/150x150/14783.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32646/15cb6cc3dcf284e530e6a2630ce08f1c37fced725a63f02ab838febe37933376a8d1096f3d100efff6fb5e66fd167ba530b3cfc83a08ce4b61ea65de42bce1d6/32646.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03473/51ed4a3dc26d9466c86653d47a379d556fceb1514187e97cab850e45fb4ff3412ca324dfcc295134f05e7db2c63ba0d2d128136859070f9897a75a91b6c2bbf5/03473.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f3ac.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/wait.png'}},
  {label: 'tell', type: 'verb', category: 'school', urls: {'lessonpix': 'https://lessonpix.com/drawings/34535/150x150/34535.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32546/90f40904f097e1a8d67fc722b7df409657f8ebf3c3a61a744af6704c0bf81aa27e03eb8e0a5e65dffdf3e15c258bc15f79edf8251cec726eb0c8664733ce8b0a/32546.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/05666/a787abd008a406b7c5c0a5f00f427a27c52282f9b9634128d70634adbe4448216c351a24406cc557293b3e843c7d8bc6e1361bfc38e7f8b8833be9c1c89c3c73/05666.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f5e3.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/tell.png'}},
  {label: 'ask', type: 'verb', category: 'school', urls: {'lessonpix': 'https://lessonpix.com/drawings/6802/150x150/6802.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32309/d109f7388163f132615ffcc3ab72b10f8aeee0d451083b2d7a6d3af64d02fc8737412b4a0df6e27c29d10346a3e3d1635ae7a7a83b4d5ac8f16a9e717ff5bbdb/32309.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/05571/3d3923664222d7d3beebedbe928c10b716db6cd2a738eab14b77f9151a586ee998d439bdac8f3f44f15767040a5a2dcd37570d1e372b3589466e3e9878fcc84a/05571.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f64b-200d-2640-fe0f.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/ask.png'}},
  {label: 'share', type: 'verb', category: 'school', urls: {'lessonpix': 'https://lessonpix.com/drawings/129/150x150/129.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32171/0f9e20e175e99ee987c45f778a11937b10ec88aa551dfec6e6ea02f154a080334f6cf80f45b01e4d4d63eb022b371b58ca760c3513eb59053e1ffb8cff51ff3f/32171.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03380/a9406a59b57a726d596985f57ff409a6386c2ce6dbff25aab2e9805ed5141d7be50af67731e42987d93a4f9f2fe099a49e3f15bf98bbd71ae7c4740e3fcbc151/03380.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f49e.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Share_36_g.svg'}},
  {label: 'get', type: 'verb', category: 'school', urls: {'lessonpix': 'https://lessonpix.com/drawings/216312/150x150/216312.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32137/3f8fe80fb3fa4deaccc98a753884b455d2e3827b8b5bcc2a2b272d0c6aa742fd626e33c58527ea699fa46c18ec6e4e6cceb6edb13088e8ff03e466e3217fbd31/32137.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03181/32ee0bd58819b5b8bc6fc4d85a4fd6c349bb4c5f1431079322cc0e5fc146778e9fcd7e6052c45cdb48542b643f21bb74f369a3a169afda2b99cf0f6291622979/03181.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f381.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Get-Water_431_g.svg'}},
  {label: 'make', type: 'verb', category: 'school', urls: {'lessonpix': 'https://lessonpix.com/drawings/52213/150x150/52213.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32219/73384a9e57bee6d6d83a44cff48fb879f89ebcfe076d4831d7c6144379f18b5e613c6ddaf037a1d65e624cfc4a3ee5dbc284011ce45526e60db4c7196a0fc53d/32219.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03267/6f580802165466e73b731922da7052de9695cceb59255c78b7deae2e7e54067cb246ef7fed8f6c59967a463db7d86acba3cab5c026b936006e7f347032583e50/03267.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f3d7.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/make%20-%20do%20-%20write.png'}},
  {label: 'heavy', type: 'adjective', category: 'describe', urls: {'lessonpix': 'https://lessonpix.com/drawings/5316/150x150/5316.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31559/24fae3178bb2f74357d59a302fd306ea06d0afe8655fc2f0f6b12c30e2854fd2e7fe24f7e2c0a40870e97edc768fd780491d2bb02c077b6c7c305c8fa1caaeac/31559.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00173/c1ff859c1a11fb287ab57ade8a7e39f2ee8a763191da444fd50eaac264f4c65deea8a29e9da42be7211cb05168900405ae90d9466a54eeb1ecc1f51a445a2007/00173.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2693.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/heavy.svg'}},
  {label: 'tall', type: 'adjective', category: 'describe', urls: {'lessonpix': 'https://lessonpix.com/drawings/879/150x150/879.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31593/d1c083b9f2a703f37e9c324ae182b686bf6aecb514436cd91ff79a7b20b71d2842449d160735446d23645383f8525b981e2f5d85eff080937a3e9a7878c40e3c/31593.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00265/a6e8dc121bc1b50033ed059cf4e83b1e052ab6670aa66ed37e16ff7e5dc1a1c4901fcc24c32199c5d7c17361e6dcb6485070299459312040813e3e41977ae3dc/00265.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f5fc.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/tall.png'}},
  {label: 'deep', type: 'adjective', category: 'describe', urls: {'lessonpix': 'https://lessonpix.com/drawings/12872/150x150/12872.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/07561/3dd6b58f348655469f8936cababec0dcf94564058d97aa9e14e0510513db700de9ad6732df9bfd9ed27a7f20c3af5dcb8ca3910be721c0d2b383d70c715ad62f/07561.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/07561/3dd6b58f348655469f8936cababec0dcf94564058d97aa9e14e0510513db700de9ad6732df9bfd9ed27a7f20c3af5dcb8ca3910be721c0d2b383d70c715ad62f/07561.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f93d-1f3fc-200d-2642-fe0f.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/deep.svg'}},
  {label: 'tight', type: 'adjective', category: 'describe', urls: {'lessonpix': 'https://lessonpix.com/drawings/47885/150x150/47885.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/56657/95e8a77442f543e2be893c798b20d15413acc0792041ab3929e51c3eb8b0d086196993f35f90642970ccba3171e2e9ae5f66ed590362e6bfcb2dd98c2350ccbf/56657.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/09170/8e20abe95c50bf2aaf5acecc807105d755125f1b311b356c273dda10fef38b951a3018b6c8b1dead8e12440c5300c70de8941e7618e4ff0c40dba5dcb2edca54/09170.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/270a.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20knot.png'}},
  {label: 'steep', type: 'adjective', category: 'describe', urls: {'lessonpix': 'https://lessonpix.com/drawings/2232/150x150/2232.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32436/de6b633157e3cefbd9a4abede7ae017cf126a297bffa95ba2dd8850037e52a35166ade5120434d9d181ad25e1f7a6311dd8d46c5518ad03ddb62dc19bf678a7a/32436.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/09168/6ef993de14f6ee3799b2bfcfe0aa4203584d22eeb1bc239bf4e6bf3988e1cfb925d0a1060c827b7ebbdeb711d14aedc4dab30dece399ea080bf33c042f90ae65/09168.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f6a0.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/mountain.png'}},
  {label: 'soft', type: 'adjective', category: 'describe', urls: {'lessonpix': 'https://lessonpix.com/drawings/5542/150x150/5542.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31588/bfff52dee7dfa0c8cd4e9c29dd3db1e0faab3a36307bcdfe810792ee56732feeb76edb12c2b6f8c2deb3707e0d31384e9b67b6a9d8a729d28b35e3537c8d0e74/31588.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00252/46fca4a68c2a25a83c8fcd30ef17828e613d072e5d0bae8dad09c2d136d7bcc2fda632b36e2be972d026aa5c68af38323080574899c19c94762b327ec4ed077c/00252.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f366.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/soft.png'}},
  {label: 'wet', type: 'adjective', category: 'describe', urls: {'lessonpix': 'https://lessonpix.com/drawings/233893/150x150/233893.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31597/d41ca9e13a0e03872237f046d12a79a325a3d3a9ef389e36e9ba09408252df992639bd8eec36367863b14d66209d1e2e48b861dd7c65592db25a6e0a41f74dc9/31597.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00282/855129366a637e6348ed6fd5d2aefa7cf8c8cf7efd4e6d515c6b5b6b49b94de366e73eb5eb01cb76d06d22bfa869ca90d0983b5716a68271c50ebc7ac7c266c1/00282.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f4a7.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/wet.png'}},
  {label: 'empty', type: 'adjective', category: 'describe', urls: {'lessonpix': 'https://lessonpix.com/drawings/24788/150x150/24788.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31549/4625602ff9c56c9c6a033a5486bef2c6de9317e5396bceb82ff4932e026f82daa6bf76f0c39d86d430efd6a75ce00db501f7358b909406312ae2a125e5ec2e4c/31549.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00143/e7ee7aa8c84df1d7e6aa78d7b5e264f5c642a0184ae595f162962ba96da972818e60c52c3dba8dbc4e2342bdb50f9e2af64a8f194b7eda073963d5adafbbeadf/00143.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f37c.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/empty.png'}},
  {label: 'bowl', type: 'noun', category: 'meal', urls: {'lessonpix': 'https://lessonpix.com/drawings/5589/150x150/5589.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31858/2cda60b2081b45354568456f324f4d97ff2c6494307bc3b502f4fcacd6f2f2903c43264fcf0de8ef8404e69325b8fd3ac557d41ba18c26228136665fee48a7e5/31858.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01668/9c57e034342d24ba65d31240b59f4a4753d11458172ef477fdf838b759a88e2726c7344c502f0e347d1a3f6384e425340f712bcf5ea4538f19543ff0dc3451e5/01668.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f963.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/bowl_1.png'}},
  {label: 'spoon', type: 'noun', category: 'meal', urls: {'lessonpix': 'https://lessonpix.com/drawings/661/150x150/661.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31869/a99405ca2a171cb3f43e1409982b6e2847771c5147d9becffcaad8b31aabf48ff511a01770307d5bd4363dfaf8b30cf85946a25d79c7d13ed9a2078b62476c4f/31869.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01722/9a2101f50766af56f9ff86f5b9ba401c534ac56d3063e9bce9f7d08017d27bf2f42f7bb75aee3514b7ba91d07fe52d000766da9d03c904e74ebac632e686b280/01722.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f944.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/spoon.png'}},
  {label: 'fork', type: 'noun', category: 'meal', urls: {'lessonpix': 'https://lessonpix.com/drawings/604/150x150/604.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31861/7fe5818cbb999c4aad83283905b46d3163ae834a70c9a3c1b4299e9d6bddc02d0cc8a8af6d0d14415df1b2c5348a4d832d914d8af6df2641fba046fab3fa7e67/31861.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01688/ac61401d66b0d93eb29d04cbb737503b32c47b5bb177159f2c8d93893ca87a7106091163126501c6b61506d54da599196be6319c6f85129aeed216fbf63dd8ef/01688.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f374.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/fork.png'}},
  {label: 'knife', type: 'noun', category: 'meal', urls: {'lessonpix': 'https://lessonpix.com/drawings/549/150x150/549.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32409/8cec8bfb231222a994003514cf25e26b56903acb73130ca831b90a6b86a6242294c7b03fa93e153ae5478e37962e22cb85ba9dfa7558edfe08278f7efc7b7138/32409.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01695/485c613d3c9dd3b566c72a239c1e80ab80e4a1ffb030d0ff8fe12b97c43e3ea919cdacd608dd65e8319e336a512e55a9dc09842bc0785dc4e5fbd50d712a865e/01695.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f52a.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/knife_3.png'}},
  {label: 'plate', type: 'noun', category: 'meal', urls: {'lessonpix': 'https://lessonpix.com/drawings/543/150x150/543.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31866/9c2f004ba83a4bfb1d5404863f9f0b9f32c1805470d77b2c58376c1a1588ad81dac8005aa462586cdce433fc4858aafe50f1ec81ea1f737c17e6f3cb2e2f2e05/31866.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01713/d30b4156f6e840f1dc90542b71e04837dd6fbae7c27eb3e004d2f24e7a6119b84922462e9e7f8fb4b0a5b254f384ed61067d0e19ad70f1c069b6740b8b5f7b27/01713.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f37d.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/plate_2.png'}},
  {label: 'cup', type: 'noun', category: 'meal', urls: {'lessonpix': 'https://lessonpix.com/drawings/1681/150x150/1681.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31859/3b5e7f036d9193ca136156949f5f59e46171e7cc0d8762c9e3651159eaa94d534ee9269d701e562d14506c7ac69d6faf99d52aab0edfef9270a5c0a7a504c8d8/31859.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01680/792996e8ec3a15daac50b83fe014b266ab2dcd323eda349138fab40fcd1bbc2af90cdf60fc33da663e50488bff12b4407af625d33c216b122758dd29912c3772/01680.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f964.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Cup-35dae4d6c2.svg'}},
  {label: 'napkin', type: 'noun', category: 'meal', urls: {'lessonpix': 'https://lessonpix.com/drawings/1717/150x150/1717.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01705/8dad58cbae9b72bb7ae3c8c7771e52d41037ecc811829b3e32c1092cb65e9eb401a7b62d9188c551a6886ea524fc88f9a7892ca02e1a0ef084fb10e5c5445c5d/01705.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01705/8dad58cbae9b72bb7ae3c8c7771e52d41037ecc811829b3e32c1092cb65e9eb401a7b62d9188c551a6886ea524fc88f9a7892ca02e1a0ef084fb10e5c5445c5d/01705.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f533.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/napkin.png'}},
  {label: 'crayon', type: 'noun', category: 'art', urls: {'lessonpix': 'https://lessonpix.com/drawings/494/150x150/494.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/55927/9270c994602654929c712b3034e90b6461eecdc0148152fb591b094c09acb921bb114ac806521b861dfe971d18f0dd32535e99aacfeb2a922e5370836b300565/55927.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01302/33c240fc9e602dc39f5d8c1a31bc55b7a37fb5ed16487d88b1d7acf3c31b8274ac71bd88cf603d8676fff79492e1a7d43df9b6b721c7a1e4b7301d92018f93da/01302.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f58d.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f58d.svg'}},
  {label: 'pencil', type: 'noun', category: 'art', urls: {'lessonpix': 'https://lessonpix.com/drawings/128/150x150/128.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/55884/41cf278845d909d83415d5138541c28e4b4c42742bf987bbacde128c894c4e97beaa6229d043ac21f80b135be5a9847edcbd694b6ef86c354071233ccec97263/55884.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01984/34737ebea2de00c06c24e7883963d8f06121e896d03edc3da8908d01df30300ad074796991afdf21328b91292f6dfd99220da641b1ba43178213db188a778f4b/01984.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/270f.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/270f.svg'}},
  {label: 'paintbrush', type: 'noun', category: 'art', urls: {'lessonpix': 'https://lessonpix.com/drawings/625/150x150/625.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31810/9a7024d09f0e1a9f69312d01ce3e2e423682dda8e2552fdd5c9f94e6ecff081df7fddafd921b3e6d14404fb46270602c1d7c0caed78d87212ded983d1e6e3e12/31810.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01306/822aa3647d91bb8f67b89aa6b55b21582c5f320cee562bf3b2558f85df7d065c02683b202dddea700a2a32935290dbf14241db83978edeadf97eb480ad2cb9b3/01306.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f58c.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f58c.svg'}},
  {label: 'chalk', type: 'noun', category: 'art', urls: {'lessonpix': 'https://lessonpix.com/drawings/13431/150x150/13431.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31937/2cf2f66da28fc844577f05a008142f72ea9014ee3805d80af1a9b8ef889301b5af6045de0734dfcc7253209011e17841b42759a3485ebebda09db4fcce7d433c/31937.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01995/26c225d3e44cbff5c0851e29ec127c4ecae7fa4590b7bea195983e4f61c4c5c721b957dd0ec333a13c633bccb8086bbe315ae03a453e63f43ab6c6ba6316b4c7/01995.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/25ab.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/chalk.png'}},
  {label: 'paper', type: 'noun', category: 'art', urls: {'lessonpix': 'https://lessonpix.com/drawings/1247/150x150/1247.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31935/5b7e149910f2d8b386249c23e6f54e864dc7bef2d81d7b9ed2e72c7968d4f613352b3069a2ead4b33d642fb4cd8b48fdeb86b0bb9563c3b9f33cb364cd98f3ef/31935.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01978/cc7fdcc958dfef8ba8bc9d37c3cb0fc68574cfeadfd22b8433bb00d7ce870ff3eb97fca050635ad7f97541a33b9cc32517455fb67be480dfb28ef81364452e0e/01978.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f4c4.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/paper.png'}},
  {label: 'scissors', type: 'noun', category: 'art', urls: {'lessonpix': 'https://lessonpix.com/drawings/647/150x150/647.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32407/6c104f1ce8f0c55b9227065aa1d10417442c70692544acc105ff749ed38e17004e6742f96aa2cd18c0973ccc2f663cfe9f766bf6e6b47597587d40fcb4047aa9/32407.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/08164/a10db812b6790a2c0d8c885b6d3dd0627650501320421ec0c272c978c033136f577f36d337767ab2847cf0da6a660d6a5f9b12f25039c4705385ad5827c615b5/08164.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2702.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/scissors.png'}},
  {label: 'stickers', type: 'noun', category: 'art', urls: {'lessonpix': 'https://lessonpix.com/drawings/7205/150x150/7205.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31820/d154b7b2c6af9734f2da0bbd4d69841b2eaa88c3797385e3099f1e430be9e693b952e8ec38525aa538ce609beb794ed59f79398380527b16cb3b27cd4981cd95/31820.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/55527/1cc93683c78d9e8fd248de5d493d43981b954ffa0a5a8a2a1c21ee42a4950348f76c0871fabd00844014e18f39738114abf09fd69689d7643c9aa72acc9f50d3/55527.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2b55.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/stickers.png'}},
  {label: 'paint', type: 'noun', category: 'art', urls: {'lessonpix': 'https://lessonpix.com/drawings/464492/150x150/464492.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32159/edea27d7097eb666251a800c948c9901052aeaa89d3ffb4f81a275b69d53548d0482a668029e14e968e7a22b53facf128f8e5a829ae840c4eaac623a043c6e09/32159.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01944/46baf6d260a63a727cac19cc03fcbbd4a86b8cd66122432c1e90c971c899b952f6ef513ad3015b1fb2522f141a568ca2c45bdf2124b5ac428ed6a99465fd4d3c/01944.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f485-1f3fd.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/paint_3.png'}},
  {label: 'twist', type: 'verb', category: 'move', urls: {'lessonpix': 'https://lessonpix.com/drawings/7424/150x150/7424.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/10829/238a718fa345289e18280583c87fd7a077d961dd1f2d82d03f380e51b383c032f4a456ecb8b0f4d299ea2a0cd605a45c6867df049df50c479ca5f3808fb5353f/10829.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/07681/f7cac8bc3d492f8368c3e2831980f4a6e0a2a33b4d24ebafd9d293c35a1591b292deb02ec761ff43d6ab59c306a9d0274521f33f93b07324099393e8705f6aec/07681.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f500.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/icon_archive/tornado_twister.png'}},
  {label: 'pull', type: 'verb', category: 'move', urls: {'lessonpix': 'https://lessonpix.com/drawings/5339/150x150/5339.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32229/9d3bf3acba995f5ba643230124fd27f87257f27de0d32d881e6086381f9b5d2bd26bef121d6a49acab5aedc1344ae39effa871391c765098af087e786c310e5b/32229.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03324/0243f6c0dca2f0952d33147eee72f331a12691dd0db2cbddffedea782cdc2df6d79e57172030ee38fb70080ce176124d53ce3e96d295a9d1ad41f22493d9bbea/03324.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f682.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/pull_238_g.svg'}},
  {label: 'lift', type: 'verb', category: 'move', urls: {'lessonpix': 'https://lessonpix.com/drawings/1155981/150x150/1155981.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32589/cd5963811128f78b1731d7545ce77eec58ca09d677edcd782d9c33cf795d5d983d1222c9e43675dbba195aac6f5edd45798eb0b3a489379568047c42f63015f9/32589.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/05709/6cc67f276dd0b3327f1b1916d308c0254b023c96502020e3157a2facc5d68cba666d7d0aae2a5b18aeddfcda615fc45e3ccdd14d8052436381e7075d609a5110/05709.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f3cb-1f3fd-200d-2640-fe0f.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20lift%20the%20toilet%20seat.png'}},
  {label: 'carry', type: 'verb', category: 'move', urls: {'lessonpix': 'https://lessonpix.com/drawings/37737/150x150/37737.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/11391/ed16f477b99b03f3f0402137a132521cfce4974854e2702b9024d7258c869da6557a960b3c830207dba6cb5f2271afdead741a25c9e0c4e98c58386d4c1cf0d6/11391.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03081/e10cca5e50c907f6212140ad389933257259b3dd5f5c8f2cd7986e1d8ea6e9e751778c66440a0ebe01d8b36a6a0612b8c706fde4db1f4542fd1e0a462f67b6af/03081.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f392.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20load_1.png'}},
  {label: 'open', type: 'verb', category: 'move', urls: {'lessonpix': 'https://lessonpix.com/drawings/55205/150x150/55205.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32158/01ef257946de107ab815dcb5803ca4bd9a421a430c08aad617c78a9c432eda4215c20bd99885d2ced3f856a5c36d42522c33a646bc1570bd07e6795104ff4f7a/32158.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03285/1153021a949bbd9d12e1f68a170834bd0d557d12a129080fd65d2150e62a7e8a27bc6f1078cd845ce000550e584f184d6ffd375e7c7903928df66c3d5e302862/03285.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f4ed.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/open.png'}},
  {label: 'close', type: 'verb', category: 'move', urls: {'lessonpix': 'https://lessonpix.com/drawings/1207417/150x150/1207417.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32656/8797b94236647b8f76e2b6ce2459113b6aa2bbfb538816bef022f883472cc3122f0ffb05ac4785cdfa973a2bc90fc2cda57695fe257101770368ac7ce70d03b9/32656.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03101/a1a1c0a95cbb8af18992ef3fd7e655005a9463fa41fd1a59a90251112b989267c4ff023d8ef1ed868fefc8e3e8af7855b06ce96eb15cddb6e52b2b23741464fa/03101.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f4ea.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Close_164_755939.svg'}},
  {label: 'break', type: 'verb', category: 'move', urls: {'lessonpix': 'https://lessonpix.com/drawings/4098/150x150/4098.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/33026/c0ef4fb39cc99bcf6aa3312bacc9648a141026c4f4bcda645af44c6456675fc3ffa459b78a83a5a6e25efc7085d761b3ef3bc5e13b4af49c2979f711476ea552/33026.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03063/3f8117e5b1354a92016b0c7cc315b1b3b122fb7a96559c85618c0fe83fc6c42cf291edefb4a3ef0669311586b6aaf3c87e725c5bef97fc3f1cdad3f56f855801/03063.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f494.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/break.png'}},
  {label: 'fold', type: 'verb', category: 'move', urls: {'lessonpix': 'https://lessonpix.com/drawings/126939/150x150/126939.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03175/d9c9020f29d95e448728670b526b25ee0718b9a36d230f0c3f83ab09aed3d534ec06ad3c4729461120eacf86fa2f26391f4087e6270eb3a02b2029f94073ea21/03175.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/03175/d9c9020f29d95e448728670b526b25ee0718b9a36d230f0c3f83ab09aed3d534ec06ad3c4729461120eacf86fa2f26391f4087e6270eb3a02b2029f94073ea21/03175.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f64f-1f3fc.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/fold.png'}},
  {label: 'circle', type: 'noun', category: 'shape', urls: {'lessonpix': 'https://lessonpix.com/drawings/224/150x150/224.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31714/236bd6105677523f1164b32682c90ebb1461251810da2aaec08f2db9cbc7002f6bce66b9304592465c187a26d36ac5af3a0ad363a1331febbb1ed0e522fd748b/31714.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00794/4619e33bfa959fcefe5258aee6a4744dca9f0780d2e29b9ff0f94a433c42bef060fa4c008829093075455c734581b6b03e160104c07dff26ab63f78da1a8386b/00794.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f535.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/circle.svg'}},
  {label: 'triangle', type: 'noun', category: 'shape', urls: {'lessonpix': 'https://lessonpix.com/drawings/172/150x150/172.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32810/f41a54cbe14ffeb13e1dd8298874e2ed8af4690eaced7a90ba67a7b4d02f1ad2964a25df64105a3527e01247bcbac0127d25a8725dfb8d3c882292164ea5df52/32810.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00801/5e068174782187963a956b3a1d76b58d455d37ca6e538d30b79c78014a85d0c99ab864379ecdd9dd5853530f577ad84d695335510295b38bd22a61a1ab65cdbb/00801.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f53a.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/triangle%20equilateral.svg'}},
  {label: 'square', type: 'noun', category: 'shape', urls: {'lessonpix': 'https://lessonpix.com/drawings/213/150x150/213.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31719/9f228377af2b42318c01108ff43a87b98510a4bbf3f86a3949819826fa72de8af6cce42e00785a805527803143d08eaec5cc4a0bf15099fd5e0239e768f489f6/31719.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00799/49e208aec201c92c6a319c6381734f23359f41836a80724ff73d5cd72dabe4c556bcfbdd3207d4bd90e9fe0048767edd86422c855fcc54055fe6c873c35954bf/00799.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/25fc.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/square.svg'}},
  {label: 'oval', type: 'noun', category: 'shape', urls: {'lessonpix': 'https://lessonpix.com/drawings/2362/150x150/2362.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31717/a0fcf1a7f5a7b06163ad18878c86197cf83eae4e038c003663429358b9816ea5caac4161dbc55856457c23ed410a85a633a726e36301dd34b747340a7a38dd08/31717.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00797/3cdcb51e6e403c1107112c46e11cfa2f1e080608e2b28c0204920e3c3f4fe3607e2ca4308960a025c7f85235081af3e3b617af3477404e538ad632b6416e52c4/00797.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f3c8.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/oval.svg'}},
  {label: 'diamond', type: 'noun', category: 'shape', urls: {'lessonpix': 'https://lessonpix.com/drawings/17100/150x150/17100.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31715/198bf906e8f7379aee94d3402cb34e40d4524b0f1a1cbde7daa585fc2895767bef54c01153d813b8bacb224718fe342d427d9121fb0cffb72cc6aacb89627fb3/31715.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00795/98df0c23253f957f62a288a37ed8d449f9fb362f92a1cea44edadeb13880ca1a63ca909e51b0d388ca86af8e6b179bad99afcee03159ea3f383e887ec45e21ed/00795.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f536.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/diamond.svg'}},
  {label: 'pentagon', type: 'noun', category: 'shape', urls: {'lessonpix': 'https://lessonpix.com/drawings/184/150x150/184.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/09692/ba1f71b6aade977123f597499fa0c093f9a8f20016ba1120cdc6039baf80c4a93f258593d71740b7829d6027acdd0d685c8f34c1eda1707a172c4149023bcf5f/09692.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/09692/ba1f71b6aade977123f597499fa0c093f9a8f20016ba1120cdc6039baf80c4a93f258593d71740b7829d6027acdd0d685c8f34c1eda1707a172c4149023bcf5f/09692.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f3e0.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/pentagon.svg'}},
  {label: 'hexagon', type: 'noun', category: 'shape', urls: {'lessonpix': 'https://lessonpix.com/drawings/7566/150x150/7566.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/09686/1c7337ce4ee46094146087d5c6d4aab08e095ce1e36cc377e2284510edb572bb82c10f1f77e89587d5998fdf265e9888f296d81798c0c411995bdb28d2c0fa40/09686.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/09686/1c7337ce4ee46094146087d5c6d4aab08e095ce1e36cc377e2284510edb572bb82c10f1f77e89587d5998fdf265e9888f296d81798c0c411995bdb28d2c0fa40/09686.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f41d.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/hexagon.svg'}},
  {label: 'crescent', type: 'noun', category: 'shape', urls: {'lessonpix': 'https://lessonpix.com/drawings/111813/150x150/111813.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32297/1a705bc10508b30c3e08ff4ebd382be4f6e5cadb768c120d59c47b14b69ce2ee3115f61f7d3f226a8fc1fe5d0f9dd616ab32bb655cd115c6874e41888f4e993a/32297.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/05343/c03ef6d4c6b937ff58a6ecab972c50c4f4b1b6d76a1a828d67e1f89d3d6662b2ffd6e12e3953803de9a405feb85243541c15549d1b760c9caac6883979921ce7/05343.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f319.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Moon%20Waning%20Crescent-cfe195b0c3.svg'}},
  {label: 'red', type: 'adjective', category: 'color', urls: {'lessonpix': 'https://lessonpix.com/drawings/212310/150x150/212310.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/19323/c7092fcd687dd6e56030e391c06f64d89ab6aabc44a5142b15474b5b5ccd518d52e2b9a253757c4d67fe0045015b1f5a495ce00af74b05faa725b81d2789b310/19323.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00694/02d4f32ccd57c4b8b3b3ebfa20ad7bb9c0620b8d16178db3374b1c92a18c67b3413a0a79affc8559dd6e0c0e29f035e7c1e24088aba0eb7df2ace80eb4214e9a/00694.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f534.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/red.png'}},
  {label: 'yellow', type: 'adjective', category: 'color', urls: {'lessonpix': 'https://lessonpix.com/drawings/212340/150x150/212340.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/19326/64826610bcc9bb5e912b29fbdd11e61f7b7ae4d406574474ccc742695b2019625407bd3618e7b42afcb1b3dfc3f3c2868153e5335cd57a35a3c5e9d4e99a7def/19326.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00698/21072c74506467b016afbcee9deeb91c04c387867fd7c1bef06f060591481fbdf5a91704bf50422b9dc80a6afa59e97e82fe47b960edfb5aa9ab844ff85895d5/00698.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2b50.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/yellow.svg'}},
  {label: 'blue', type: 'adjective', category: 'color', urls: {'lessonpix': 'https://lessonpix.com/drawings/212315/150x150/212315.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/19315/3113c5de172461a596559c8be57f189e55a861d87f2b3ec0d35393fdce8de3bc6311fe80d82277cc5284c5628a9b44b313d8858df1c46379a53f6a6c48ac8330/19315.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00686/a16a47b5a53da1be23e9fbad0a9559c55645eeeee65c5a8b4e305ae0222b5ccf1a5be0073046b91bb5b61bd280a5bd70007edf86ffbae987f201c32ef7e1e0f3/00686.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f499.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/blue.svg'}},
  {label: 'gray', type: 'adjective', category: 'color', urls: {'lessonpix': 'https://lessonpix.com/drawings/212322/150x150/212322.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/19318/214069f66b4139162acd9b0c2b4732c83db7321c7a01653afa15ec945c265d769145be4531c24a3755fdae82621b634d9dd1b6d36d4b195e0c316c20d18a1bff/19318.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00689/8bd4a41e511ef530c79ba94217f9c8fa7a36e284eeacf66da699b9b4b7611e190d3f15edd9c640386b2dc67563954890f25673283319ee8f797a8c7ba69f4451/00689.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f988.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/grey.png'}},
  {label: 'green', type: 'adjective', category: 'color', urls: {'lessonpix': 'https://lessonpix.com/drawings/212324/150x150/212324.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/19319/ab20b02aaacae0e737868a8a450b9c4028fe20757ee2d73ca3cfdd8c4d4efc8799b5e650709be2b266ea92a660547a6c28eef82ac3f711ea513a966e3dfb1362/19319.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00690/7d8ce6a3ae1900cc7299e30e99fa4d3e771200e5a20f79618ed921f33f06260490ec3e447cfa1ac431e3f4e8d4c89512dce24d0ccabc061a4161e951a7bc008b/00690.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f4d7.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/green.svg'}},
  {label: 'purple', type: 'adjective', category: 'color', urls: {'lessonpix': 'https://lessonpix.com/drawings/212332/150x150/212332.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/19322/e620e1371089c0f8343e6ef86ff14178fe5984fdaca290ce78cf3d24ebf0f6889bf1430fc728ec56ef701c4d0ff99f046e61bfc31770a643cc0c3eeca9f92eb0/19322.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00693/bef0d669a0edcda5e32436bd493aa08545e02bf434e25ef0d0dda663fc569b86a223e4bbed507d2e04cd69e551cec0d0518b2c764a6abeb6d05ece0594a5f77b/00693.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f49c.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/purple.svg'}},
  {label: 'pink', type: 'adjective', category: 'color', urls: {'lessonpix': 'https://lessonpix.com/drawings/212328/150x150/212328.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/19321/aada8b1bfe95ae155d3be2203961f93be95ef449bb721520fa858c42ba72f175cee7c156b51b0cb68e41144036986baf4c09d0c2c37aa7bb9568fe3a7926afdf/19321.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00692/a141b905bd3851a52fee81f29fd012d396860c57ad87189e93dab21250ee8ecfe8b3faa536e94c0525cf098bf028f60f5e837c0acf74c21a41edb0c551a56786/00692.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f338.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/pink.svg'}},
  {label: 'brown', type: 'adjective', category: 'color', urls: {'lessonpix': 'https://lessonpix.com/drawings/212319/150x150/212319.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/19316/1828c2e5e15b6e9350b3c9ca447ac8019188014e7ce31a80f228fc28eb556689e7fadc2f4755412bdcaf3a2cbb3ae7c5e773d5d642a8d6fd09b3370466283640/19316.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00687/febb78724099116d43d9e25c85a0c94a5949360684e40def745091e8504a35e0ff3645dc976594a63c161324dfdaa6310f334a92fedeb84c8a960c4da669ba96/00687.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f43b.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/brown.svg'}},
  {label: 'sandwich', type: 'noun', category: 'food', urls: {'lessonpix': 'https://lessonpix.com/drawings/2035/150x150/2035.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/55147/a71a193cfa605e2cd6e4dbe2bce1c1e71012f5e99abcea3259564e84ef0d9e09da19691398fbced68c66e869763bd829c32b82ef41d5a518261b0218808e653f/55147.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00428/ee6628c5dd784db143073d5a01b91ddf02e597b94c7463fc06fc0996b7134e53b565036e1d0848299f0c6172ae5e8b7292af1b70a1c628885f3a0befc5b574f0/00428.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f96a.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/sandwich.png'}},
  {label: 'burrito', type: 'noun', category: 'food', urls: {'lessonpix': 'https://lessonpix.com/drawings/13745/150x150/13745.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/56221/d49090393c67d6b684787acb537f8c8d6ca64090793dc0257389e9f66d93f00df47f55d67405e80b84277cae106b9dbe8e515bcb449a3503d6c446049b7d86ee/56221.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00323/683f8bb1594d0acda92b5fad0ecc4d4c2649aac2537867e0a461ebab003335c934d309e3f9a08bd7db181b0acff0bc2186d262bacfd0b6a30e02cd0c6e56bc5b/00323.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f32f.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f32f.svg'}},
  {label: 'spaghetti', type: 'noun', category: 'food', urls: {'lessonpix': 'https://lessonpix.com/drawings/2046/150x150/2046.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/55113/150c3bfb314733f381dbc3b116d4621576e49600bca46e989c1d5311cc1c0f72b0eb71b83ff3665d522d58413affa8431ad7c38ab7c757c0638be5361251c122/55113.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00406/ecc71f2d8aeccd8d87a9290cd610d3361ce16f136a83ba92f9f4f621d7fe785d5e67526f4c43f5da3b42a99533a6102b2916f0cb3976105c5173102787700df7/00406.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f35d.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f35d.svg'}},
  {label: 'hamburger', type: 'noun', category: 'food', urls: {'lessonpix': 'https://lessonpix.com/drawings/1999/150x150/1999.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/56103/7baf58b62bb7d902a86182824e3fbfc47dbe5532148bc5970b5dc0edd9d1311d7136b6b75c9e80dceb1f2042584d6dd83b2d32a2d9368c7e50b16bf253be7f83/56103.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/09246/6af568e557598ad35217bb8782eb9648509f2176eaf2aeb664e1761822bc7bbcb2ce0ef1184206a2ff7079dd02cca6689b5fd146fbdd70986d3746c23241a11d/09246.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f354.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f354.svg'}},
  {label: 'taco', type: 'noun', category: 'food', urls: {'lessonpix': 'https://lessonpix.com/drawings/3831/150x150/3831.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/55073/3820fcbc8a86b9cd4d7cdfb8c32adf8cab7b481a8d62c23bbc6557ad67ba38fb4039a433623f28b91b7a9a9a1662c3c691923b31ae8e91c7145d69f6ab433df2/55073.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00412/9e2c34f619a80cabdc44b1b916c89a6c8cd98aea5afffa0eded660e1c96fe473f3e0d94a48a6b3662c15f3b5415efa04448595125c5730c962108df524884e7d/00412.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f32e.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f32e.svg'}},
  {label: 'rice', type: 'noun', category: 'food', urls: {'lessonpix': 'https://lessonpix.com/drawings/52207/150x150/52207.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/55925/54cda89dfdda273ccbc013e1a418dc41fc08f46820c7b4be32f617f6725f37f70a5e6b7ae9005cd2a10f8e9a8d22ad35f0740a942dd5b908f0439450ecc632d7/55925.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/05155/14e535a07c1532c046b6e697feef5c9e43af7ffce2c8cab6050b4b012142285e81737eaa99ceab22247c33c48295298845bfc27a1bd5135986136119956125c7/05155.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f35a.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f35a.svg'}},
  {label: 'cheese', type: 'noun', category: 'food', urls: {'lessonpix': 'https://lessonpix.com/drawings/1961/150x150/1961.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31613/0beb595b9461c963bc1baf23cf0a5e183d226fda4063dd8e1ff0ffca055c8c7e0e8b61d2c21f417a84e772998365c7e1d18b2f4d2120f5f7b4b504c90e663afc/31613.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00327/578480daabae7e22e332d9f93d9b531b389035c1c4273cd8c1db24790cc2b936361177a8dfb71da09f87be790ac84a5c1fb4ff8addb040fa5284a4a4aa54a53c/00327.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f9c0.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/cheese.png'}},
  {label: 'noodles', type: 'noun', category: 'food', urls: {'lessonpix': 'https://lessonpix.com/drawings/70699/150x150/70699.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/19277/8e68910742d617f61e6569cb32c45d7065e1f3489c4f1a40822cfa7a0b248cb861d79a0db7ceb8a6f3fe996826cebe79bd8c1a66001d80e780536780ac45f69d/19277.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00374/ec834a25052a76d7c5c541c237230aeb920a5d7ef31c3d98977bdc65344ddca81fbada8085041ad8d77972afebb6e275ddcfbf7d5be97cb2bb26dfbca15e0690/00374.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f35c.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/noodles.png'}},
  {label: 'mouth', type: 'noun', category: 'body', urls: {'lessonpix': 'https://lessonpix.com/drawings/6961/150x150/6961.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32633/2ac9c74497650cfd14d3a70ea32b0774a5fb4ed9955e32e1226782acaadee328a73aba16c14e8e7bd1540f2705a99be0eaba3da22203f6740f19532cf8b94ffe/32633.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01101/c894f93b793ffe890616e765c106770344c8df809d7ccd5f1690bcc82a86ce9c3808c309c41953bfeb0858cb10ffbca3a9c03be5aab193d09873ab43015677d9/01101.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f444.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/mouth.png'}},
  {label: 'ear', type: 'noun', category: 'body', urls: {'lessonpix': 'https://lessonpix.com/drawings/18490/150x150/18490.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31771/70227b8c1710b8f16f453f7850dcf692e77c7a21d364d4e25783b457e8379651142beb27b55538daa7146200b083810246ad1b10f71295d187fb8824027319ef/31771.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01071/7187c871318387b706a07720db1323c1de290c79aa51714e29dd6309480abe971e67235a27b95678173b50e45b010d5a85c55d7c686c1ff4d165ef839ab4b2a9/01071.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f442-1f3ff.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/ear.png'}},
  {label: 'nose', type: 'noun', category: 'body', urls: {'lessonpix': 'https://lessonpix.com/drawings/500/150x150/500.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31782/705243e190fef774d15a7faa7ccb52c559eba97e0cc8f070c999f53a301f7ae59e1e68da9399baa17318b14e4d843be23d5c542d17dce59fe0ee69b421b24a7e/31782.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01106/899960014b8555de967038b1e5df4839a8fa277e6b8285dd4025740c9b2dcca9c0599849afdfd607e5ce99322bfd70348939f93da2ac9c31928d80eb8bfd602d/01106.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f443-1f3fd.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/nose.png'}},
  {label: 'hand', type: 'noun', category: 'body', urls: {'lessonpix': 'https://lessonpix.com/drawings/467/150x150/467.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31777/816d5a0a652a30915b396d80cbc5b4d2d3797ac5e02a6ea10bd9d24c0ba7c9009d838103385867597949d75f976bc4b28947a01d1f380c9643f08b5783633757/31777.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01089/5e18c3687bb76937d63c2cec1c789e582d54382cf02c32bf6a83bedc6fb50d0cc52dcfaa17a26f65b7139b089e5a91e2c6f81de114152f06e0d3a5a2921d1df7/01089.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/270b.svg   ', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/hand.png'}},
  {label: 'foot', type: 'noun', category: 'body', urls: {'lessonpix': 'https://lessonpix.com/drawings/33653/150x150/33653.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/31775/4c1fc1a32772436dbc84a82e7d13db4fe7edc20782112acf7edb152738ee7028ae0bd75dc354ae7af8f79f1c46a43b24af77066188a01a291fdf1d336d0149a6/31775.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01083/6ddf6bdc255f1b554e4a31b4be7f18cb028505911f760541412b9c0d9af5ec368f0862df5aad3324135d0addcd90c6c0bf7d44bc4bec37da918a3c843fa8fb8e/01083.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f9b6-1f3fd.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/feet_2.png'}},
  {label: 'shoulder', type: 'noun', category: 'body', urls: {'lessonpix': 'https://lessonpix.com/drawings/525/150x150/525.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01108/07a5304848c216b5c9fc04693e1e4c3b4f4762694f53dd00695f0274777a23caa98bab29e691d435ad73ac5a079bfafa6b8c7fcdb5151f96e5b8435c16698be5/01108.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01109/6a336920eec3a3ef358521b2b96e1c5efe7776ceb555fc7a0b8aa7cb77232e38230385756caf2fbe72c9ad09866636686426a0bd7ead766231e5e9c646b80fc0/01109.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f937.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/shoulder.png'}},
  {label: 'eye', type: 'noun', category: 'body', urls: {'lessonpix': 'https://lessonpix.com/drawings/431/150x150/431.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/32630/f1193621221dbe741e21c613e9a5cbdba24a2aee514d60881027357000fa3e930f86d53bd2165ab1d4f5c81dbf266963c9fd847e2ca88e5f12c52e9dd3291c55/32630.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/05059/860945f247254e523af91789f2057ab9a8269e6bc626e9286abc63683d7e930339846e2f760116fdf3d434b19a0f431ebf59fedfc8c594f4978e1e17c045fdcb/05059.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f441.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/eye.png'}},
  {label: 'knee', type: 'noun', category: 'body', urls: {'lessonpix': 'https://lessonpix.com/drawings/409/150x150/409.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/07791/348723ef539c709d49cb27c2cb728af5c379090059df045d642a7c854a9e106ebf68f9d5051118215c0c35002e0cfd76829066657bd020cfea134e2ca8ed30d6/07791.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01095/fe6e8f0e7cac2629648fefef893683ce5fb565caf2e82da28ac2a1f45d669b739a7edf5a118ffbacfbe32f1b74026b0ef7e5feb2c41377725b14abd32bef6976/01095.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f6d0.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/knee.png'}},
  {label: 'sun', type: 'noun', category: 'space', urls: {'lessonpix': 'https://lessonpix.com/drawings/5660/150x150/5660.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/55285/e1bfb49a1f570e48fe1dfcb7ccde9d6ce84c8d72a7b7ed09f254789357a4d73f1e884c08eae2aad5170070a978f6aea77433b467691bbb3b33bbe951be7fb6fa/55285.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/00306/d7fa10532a5fa0806017f2edc7d2e5961fccd6531ce42bc3bdf87bbb850059e77d81e3ab8102abbe9b9f4d2b2ffbc9f073a2dc590f2e74f24c14e4119b43f72d/00306.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2600.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2600.svg'}},
  {label: 'moon', type: 'noun', category: 'space', urls: {'lessonpix': 'https://lessonpix.com/drawings/5033/150x150/5033.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/05343/c03ef6d4c6b937ff58a6ecab972c50c4f4b1b6d76a1a828d67e1f89d3d6662b2ffd6e12e3953803de9a405feb85243541c15549d1b760c9caac6883979921ce7/05343.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/05341/87e55bd1a1b976d1bfdf01d762c68a5f8b7ae818b0d2beab49d5796c85c88eaf3b1d99d84ded89a7cce466d0dad60146929553298e55a48475e4423882f267f7/05341.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f314.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f31b.svg'}},
  {label: 'asteroid', type: 'noun', category: 'space', urls: {'lessonpix': 'https://lessonpix.com/drawings/594817/150x150/594817.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/13055/9079d5018a306192c9b5c855e9d5a7251c9f10a672aa432e79667b79962a581547f60bc3934da2ed9c3a8369bd23fb31b570ce097bd362e00151d99bf5b422e9/13055.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/13055/9079d5018a306192c9b5c855e9d5a7251c9f10a672aa432e79667b79962a581547f60bc3934da2ed9c3a8369bd23fb31b570ce097bd362e00151d99bf5b422e9/13055.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f94c.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/rock.png'}},
  {label: 'planet', type: 'noun', category: 'space', urls: {'lessonpix': 'https://lessonpix.com/drawings/5236/150x150/5236.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/08215/c1082cc4e41a6f67bb31f9aeebb304b7d8a670a0bb55ea4e9485c920f562cef139cf58200fac9d51f828ddac2ccae6a3f1d9eb9efe0d7888a0e81e4144efaf82/08215.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/08215/c1082cc4e41a6f67bb31f9aeebb304b7d8a670a0bb55ea4e9485c920f562cef139cf58200fac9d51f828ddac2ccae6a3f1d9eb9efe0d7888a0e81e4144efaf82/08215.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f534.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Planet-309280db81.svg'}},
  {label: 'earth', type: 'noun', category: 'space', urls: {'lessonpix': 'https://lessonpix.com/drawings/4052/150x150/4052.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/33017/721f98731d34d64041aea6e179284d644b65f3ac6032caed1c14be2736ded18ccf42fed7729faeacf0ef6d20c4c1ebe4c46e86cc101e022eed3ac1ed172af388/33017.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01858/9591770218751523794c29514aed4f0ec255e327654c3d8b159c20828264aa7530f82fa922728ff77c78cda809b4675855167c674df9f4a2e76833f586498c32/01858.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f30e.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f30e.svg'}},
  {label: 'galaxy', type: 'noun', category: 'space', urls: {'lessonpix': 'https://lessonpix.com/drawings/47704/150x150/47704.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/01835/de7d934a6b759bb98eb85297fba022654a463cb884be365487c0bf33f37e8e0abe5e3c96e9514f6472cee6e59d3d205a20aaa4e1dee3a3a232670fa06eea524e/01835.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/13623/b659e739e7250ff052c0c76fbb5f2db3c8389c95916f37b15b4a2579bc50a4f3858575728734b9fe8c69794d08c91638512f7ee006e7937c89c39435160a2ff9/13623.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f30c.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/Milky%20Way.svg'}},
  {label: 'satellite', type: 'noun', category: 'space', urls: {'lessonpix': 'https://lessonpix.com/drawings/592029/150x150/592029.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/06887/c4a44d084e37fd7a7f088197609759b914a33d2c4b05a249cf84461cd9c301dea03ba5e91cb5c4f4bade3c5ca2aca151ff0cd29a0ea06185e289851955bcab4c/06887.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/06887/c4a44d084e37fd7a7f088197609759b914a33d2c4b05a249cf84461cd9c301dea03ba5e91cb5c4f4bade3c5ca2aca151ff0cd29a0ea06185e289851955bcab4c/06887.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f6f0.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/satellite.svg'}},
  {label: 'comet', type: 'noun', category: 'space', urls: {'lessonpix': 'https://lessonpix.com/drawings/594891/150x150/594891.png', 'pcs_hc': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/08190/8d28e493771f54f4e1392a1ee8af05382aa745dbd1e7eb51fd0321740a811da832358d6dd461b43ebaed7fe8de96e6392cb409a1916502f59609c08efdc988d3/08190.svg', 'pcs': 'https://d18vdu4p71yql0.cloudfront.net/libraries/pcs/08190/8d28e493771f54f4e1392a1ee8af05382aa745dbd1e7eb51fd0321740a811da832358d6dd461b43ebaed7fe8de96e6392cb409a1916502f59609c08efdc988d3/08190.svg', 'twemoji': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2604.svg', 'default': 'https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/2604.svg'}},
];
obf.register("eval", function(key) {
  // https://www.youtube.com/watch?v=I71jXvIysSA&feature=youtu.be
  // https://www.youtube.com/watch?v=82XZ2cKV-VQ
  // https://www.youtube.com/watch?v=7ylVk9n5ne0
  // Communication Matrix
  //
  // What we want to know:
  // - How small of a button can they handle?
  // - How many buttons per screen can they handle?
  // - Can they handle symbols or photos better?
  // - Can they pick up and start using a new board set?
  // - Can they read? At what level? Single words, sentences?
  // - Is it possible to end with a recommendation?
  // Expressive and Receptive Language 
  // MLU
  // Breadth of language, sentence complexity
  // Start w/ brief introduction and explanation for each assessment
  // (navigation for start, skip, too difficult)
  // Noun/Verb/Adjective Vocabulary
  //   find the [noun]
  //   (with/without words on the buttons, but maybe words in prompt)
  // Functional Vocabulary
  //   "find the one you [eat, clean with, drive]"
  // Category Recognition (not all symbol libraries will work here)
  //   "find the group that [noun] goes with"
  // Concept Association
  //   "find the one that goes with ____"
  // Inclusion
  //   "find the one that is a ______"
  // Exclusion
  //   "find the one that is not a ______"
  var res = {};
  var board = null;
  // TODO: prevent home button navigation during an eval
  var opts = key.split(/-/);
  if(opts[1] == 'start') {
    assessment = {
      step: 0
    };
  } else if(!assessment || assessment.step == undefined) {
    runLater(function() {
      app_state.jump_to_board({key: 'obf/eval-start'});
      app_state.set_history([]);
    })
    return;
  }
  window.assessment = assessment;
  assessment.level = assessment.level || 0;
  var level = levels[assessment.level];
  var step = level[assessment.step];
  if(assessment.step == 0) {
    board = obf.shell(3, 6);
    board.background_image_url = "https://thetechnoskeptic.com/wp-content/uploads/2019/03/NightSky_iStock_den-belitsky_900.jpg";
    board.background_position = "stretch";
    if(step.intro == 'intro') {
      board.background_text = "Welcome to the Assessment Tool! This tool helps evaluate a communicator's ability to access and understand buttons and symbols. Feel free to stop the evaluation at any time by Exiting Speak Mode. You can add notes on the supports you offered once the evaluation has completed.";
    } else if(step.intro == 'find_target') {
      board.background_text = "The first evaluation will show a single target at different locations and sizes to help assess ability to identify and access targets.";
    } else if(step.intro == 'diff_target') {
      board.background_text = "Next will show multiple targets at different sizes and layouts to determine ability to differentiate between multiple targets.";
    } else if(step.intro == 'symbols') {
      board.background_text = "This next evaluation will use different styles of pictures to see if the user has more success with one style over another";
    }
    board.add_button({
      label: 'start',
      skip_vocalization: true
    }, 2, 5);
    res.handler = function() {
      if(app_state.get('speak_mode')) {
        assessment.step++;
        if(!level[assessment.step]) {
          assessment.level++;
          assessment.step = 0;
        }
        app_state.jump_to_board({key: 'obf/eval-' + assessment.level + '-' + assessment.step});
        app_state.set_history([]);
      }
      return {highlight: false};
    };
  } else {
    board = obf.shell(step.rows, step.cols);
    var prompt = words.find(function(w) { return w.label == 'cat'; });
    board.background_position = "stretch";
    board.background_text = "Find the " + prompt.label;
    board.background_prompt = {
      text: "Find the " + prompt.label,
      loop: true
    };
    var loc = null;
    var spacing = step.spacing || 1;
    var rows = step.rows / spacing;
    var cols = step.cols / spacing;
    var offset = (assessment.attempts || 0) % spacing;
    var events = (((assessment.events || [])[assessment.level] || [])[assessment.step] || []);
    var prior = events[events.length - 1];
    var resets = 0;
    while(!loc || (prior && loc[0] == prior.crow && loc[1] == prior.ccol)) {
      loc = [Math.floor(Math.random() * rows), Math.floor(Math.random() * cols)];
      var q = (loc[0] < (rows / 2) ? 0 : 1) + (loc[1] < (cols / 2) ? 0 : 2);
      // try (but not too hard) to jump to a different quadrant
      if(resets < 3 && prior && prior.q == q) {
        resets++;
        loc = null;
      }
    }
    // TODO: make sure we're occasionally hitting the edges
    // TODO: occasionally add a little gravity near areas where they're getting it wrong
    board.add_button({
      id: 'button_correct',
      label: prompt.label, 
      skip_vocalization: true,
      image: {url: prompt.urls.default}, 
      sound: {}
    }, loc[0] * spacing + offset, loc[1] * spacing + offset);
    var used_words = {};
    for(var idx = 0; idx < rows; idx++) {
      for(var jdx = 0; jdx < cols; jdx++) {
        var word = null;
        if(step.distractors) {
          var unused = words.filter(function(w) { return w != prompt && !used_words[w.label]; });
          var fails = 0;
          var tries = 0;
          while(tries < 20 && (!word || used_words[word.label] || !word.urls.default)) {
            tries++;
            word = unused[Math.floor(Math.random() * unused.length)];
            if(word && word.category == prompt.category && fails < 3 && tries < 15) {
              word = null;
              fails++;
            }
          }
          used_words[word.label] = true;
        }
        board.add_button({
          label: !step.distractors ? '' : word.label,
          skip_vocalization: true,
          image: !step.distractors ? null : {url: word.urls.default},
        }, idx * spacing + offset, jdx * spacing + offset)
      }
    }
    var handling = false;
    res.handler = function(button) {
      var r = -1, c = -1;
      var cr = -1, cc = -1;
      var grid = button.board.get('grid');
      for(var idx = 0; idx < grid.rows; idx++) {
        for(var jdx = 0; jdx < grid.columns; jdx++) {
          if(grid.order[idx][jdx] == button.id) {
            r = idx;
            c = jdx;
          }
          if(grid.order[idx][jdx] == 'button_correct') {
            cr = idx;
            cc = jdx;
          }
        }
      }
      var board = button.board;
      var time_to_select = (new Date()).getTime() - board.get('rendered');
      if(app_state.get('speak_mode')) {
        if(handling) { return {highlight: false}; }
        handling = true;
        // ding, wait, then jump!
        speecher.click(button.id == 'button_correct' ? 'ding' : null);
        assessment.attempts = (assessment.attempts || 0) + 1;
        assessment.correct = (assessment.correct || 0);
        assessment.events = assessment.events || [];
        assessment.events[assessment.level] = assessment.events[assessment.level] || [];
        assessment.events[assessment.level][assessment.step] = assessment.events[assessment.level][assessment.step] || [];
        assessment.events[assessment.level][assessment.step].push({
          rows: button.board.get('grid.rows'),
          cols: button.board.get('grid.columns'),
          srow: r,
          scol: c,
          crow: cr,
          ccol: cc,
          q: (cr < (button.board.get('grid.rows') / 2) ? 0 : 1) + ((cc < (button.board.get('grid.columns') / 2) ? 0 : 2)),
          correct: button.id == 'button_correct',
          time: time_to_select
        });
        if(button.id == 'button_correct') {
          assessment.correct++;
        }
        var next_step = false;
        if(assessment.attempts >= (step.min_attempts || attempt_minimum) && assessment.correct / assessment.attempts >= mastery_cutoff) {
          next_step = true;
          assessment.fails = 0;
        } else if(assessment.attempts > 1 && assessment.attempts >= (step.min_attempts || attempt_minimum) && assessment.correct / assessment.attempts <= non_mastery_cutoff) {
          assessment.fails = (assessment.fails || 0) + 1;
          next_step = true;
        } else if(assessment.attempts >= attempt_maximum) {
          assessment.fails = (assessment.fails || 0) + 1;
          next_step = true;
        }
        if(assessment.fails >= 2) {
          assessment.fails = 0;
          assessment.attempts = 0;
          assessment.correct = 0;
          assessment.step = 0;
          assessment.level++;
          // next level
        } else if(next_step) {
          assessment.step++;
          assessment.attempts = 0;
          assessment.correct = 0;
          // next step
          if(!levels[assessment.level][assessment.step]) {
            assessment.step = 0;
            assessment.level++;
            assessment.fails = 0;
            // next level
          }
        }
        runLater(function() {
          app_state.jump_to_board({key: 'obf/eval-' + assessment.level + "-" + assessment.step + "-" + assessment.attempts});
          app_state.set_history([]);  
        }, 1000);
      }
      return {highlight: false, sound: false};
    };
  }
  // TODO: need settings for:
  // - force blank buttons to be hidden
  // - background image (url, grid range, cover or center)
  // - text description (same area, over the top of bg)
  if(board) {
    res.json = board.to_json();
  }
  return res;
});
obf.register("emergency", function(key) {

});
window.obf = obf;

export default obf;
