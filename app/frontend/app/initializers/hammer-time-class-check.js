import CoughDrop from '../app';

export default {
  name: 'defer_readiness',
  initialize: function(container, app) {
    if(window.Hammer && window.Hammer.time && window.Hammer.time.getTouchAction) {
      var pre = window.Hammer.time.getTouchAction;
      window.Hammer.time.getTouchAction = function(element) {
        if(element.classList && element.classList.contains('touchy')) {
          return 'none';
        } else {
          return pre(element);
        }
      };
    }
  }
};
