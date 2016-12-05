import CoughDrop from '../app';

export default {
  name: 'store-setter',
  initialize: function(instance) {
    CoughDrop.store = instance.lookup('service:store');
  }
};

