import Ember from 'ember';
import CoughDrop from '../app';
import persistence from '../utils/persistence';
import stashes from '../utils/_stashes';
import coughDropExtras from '../utils/extras';
import app_state from '../utils/app_state';
import session from '../utils/session';
import capabilities from '../utils/capabilities';

export default {
  name: 'session',
  initialize: function(container, app) {
    CoughDrop.app = app;
    CoughDrop.container = container;
    session.setup(container, app);
    session.restore();
    persistence.setup(container, app);
    stashes.connect(container, app);
    coughDropExtras.setup(container, app);
    app_state.setup(container, app);
  }
};
