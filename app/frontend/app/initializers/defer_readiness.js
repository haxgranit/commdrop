import extras from '../utils/extras';

export default {
  name: 'defer_readiness',
  initialize: function(app) {
    if(!window.cough_drop_readiness) {
      window.CoughDrop.app = app;
      app.deferReadiness();
    }
    extras.advance('init');
  }
};
