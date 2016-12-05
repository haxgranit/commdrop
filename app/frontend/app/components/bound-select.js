import Ember from 'ember';

export default Ember.Component.extend({
  tagName: 'span',
  content: null,
  prompt: null,
  action: Ember.K, // action to fire on change

  _selection: Ember.computed.reads('selection'),

  init: function() {
    this._super(...arguments);
  },
  select_style: function() {
    if(this.get('short')) {
      return Ember.String.htmlSafe('height: 25px;');
    } else {
      return Ember.String.htmlSafe('');
    }
  }.property('short'),

  actions: {
    change() {
      const selectEl = this.$('select')[0];
      const selectedIndex = selectEl.selectedIndex;
      const content = this.get('content');

      // decrement index by 1 if we have a prompt
      const hasPrompt = !!this.get('prompt');
      const contentIndex = hasPrompt ? selectedIndex - 1 : selectedIndex;

      const selection = content[contentIndex];

      // set the local, shadowed selection to avoid leaking
      // changes to `selection` out via 2-way binding
      this.set('_selection', selection);

      const changeCallback = this.get('action');
      changeCallback(selection.id);
    }
  }
});
