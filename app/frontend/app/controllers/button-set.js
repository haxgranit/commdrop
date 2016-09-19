import modal from '../utils/modal';

export default modal.ModalController.extend({
  sorted_buttons: function() {
    var words = this.get('model.button_set.buttons') || [];
    words.forEach(function(b, idx) {
      b.label = b.vocalization || b.label;
      words.forEach(function(b2, idx2) {
        b2.label = b2.vocalization || b2.label;
        if(b.label.toLowerCase() == b2.label.toLowerCase() && idx != idx2) {
          b.repeat = true;
        }
      });
    });
    words = words.sort(function(a, b) { if(a.label.toLowerCase() < b.label.toLowerCase()) { return -1; } else if(a.label > b.label) { return 1; } else { return 0; } });
    return words;
  }.property('model.button_set.buttons'),
  sorted_filtered_buttons: function() {
    var list = this.get('sorted_buttons') || [];
    var res = list;
    if(this.get('filter') == 'repeats') {
      res = list.filter(function(w) { return w.repeat; });
    }
    return res;
  }.property('sorted_buttons', 'filter'),
  show_all: function() {
    return this.get('filter') != 'repeats';
  }.property('filter'),
  show_repeats: function() {
    return this.get('filter') == 'repeats';
  }.property('filter'),
  actions: {
    download_list: function() {
      var element = document.createElement('a');
      var words = this.get('sorted_filtered_buttons').mapBy('label').uniq();
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(words.join("\n")));
      element.setAttribute('download', this.get('model.board.key').replace(/\//, '-') + '-words.txt');

      element.style.display = 'none';
      document.body.appendChild(element);

      element.click();

      document.body.removeChild(element);
    },
    filter: function(type) {
      this.set('filter', type);
    }
  }
});
