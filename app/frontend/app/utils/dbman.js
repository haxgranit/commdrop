import capabilities from './capabilities';

var dbman = {
  not_ready: function(method, options, promise) {
    if(capabilities.db === undefined) {
      capabilities.queued_db_actions.push([method, options]);
      return true;
    } else if(capabilities.db === false) {
      promise.reject({error: "db not initialized"});
      return true;
    }
    return false;
  },
  success: function(record) {
    console.log(record);
  },
  error: function(err) {
    console.error(err);
  },
  find: function(store, key, success, error) {
    success = success || capabilities.dbman.success;
    error = error || capabilities.dbman.error;

    if(store == 'board' && key && key.match(/\//)) {
      var index = key.match(/^tmp_/) ? 'tmp_key' : 'key';
      return capabilities.dbman.find_all(store, index, key, function(list) {
        if(list[0] && list[0].data) {
          success(list[0].data);
        } else {
          error({error: "no record found for " + store + ":" + key});
        }
      }, error);
    } else if(store == 'user' && key && !key.match(/^\d+_\d+$/)) {
      var index = 'key';
      return capabilities.dbman.find_all(store, index, key, function(list) {
        if(list[0] && list[0].data) {
          success(list[0].data);
        } else {
          error({error: "no record found for " + store + ":" + key});
        }
      }, error);
    }
    return capabilities.dbman.find_one(store, key, success, error);
  },
  uniqify_key: function(key, store, index) {
    if(index == 'id' || index == 'storageId') {
      key = store + "::" + key;
    }
    return key;
  },
  normalize_record: function(record, store) {
    if(record.raw) {
      record.raw = record.raw && capabilities.decrypt(record.raw);
    }
    if(record.id) {
      record.id = record.id.replace(new RegExp("^" + store + "::"), '');
    }
    if(record.storageId) {
      record.storageId = record.storageId.replace(new RegExp("^" + store + "::"), '');
    }
    return record;
  },
  find_one: function(store, key, success, error) {
    key = capabilities.dbman.uniqify_key(key, store, 'id');
    var normalize = capabilities.dbman.normalize_record;
    capabilities.dbman.find_one_internal(store, key, function(record) {
      success(normalize(record, store));
    }, error);
  },
  find_one_internal: function(store, key, success, error) {
    success = success || capabilities.dbman.success;
    error = error || capabilities.dbman.error;

    // TODO: this is raising some kind of error mobile safari 8
    var transaction = null;
    try {
      transaction = capabilities.db.transaction([store], 'readonly');
    } catch(e) {
      capabilities.db_error = {
        message: e.message || e.getMessage(),
        store: store,
        key: key
      };
        error({error: "db transaction error for " + store + ", " + key + ": " + (e.message || e.getMessage())});
      return;
    }
    var getter = transaction.objectStore(store);
    var res = getter.get(key);
    res.onsuccess = function(event) {
      var record = event.target.result;
      if(record) {
        success(record);
      } else {
        error({error: "no record found for " + store + ":" + key});
      }
    };
    res.onerror = function() {
      error({error: "error retrieving record from db"});
    };
  },
  store: function(store, record, success, error) {
    success = success || capabilities.dbman.success;
    error = error || capabilities.dbman.error;
    if(record.id) {
      record.id = capabilities.dbman.uniqify_key(record.id, store, 'id');
    }
    if(record.storageId) {
      record.storageId = capabilities.dbman.uniqify_key(record.storageId, store, 'id');
    }
    record.persisted = record.persisted || (new Date()).getTime();
    record.raw = capabilities.encrypt(record.raw);
    record.changed = record.changed || false;

    var normalize = capabilities.dbman.normalize_record;
    capabilities.dbman.store_internal(store, record, function(new_record) {
      success(normalize(record, store));
    }, error);
  },
  store_internal: function(store, record, success, error) {
    var transaction = capabilities.db.transaction([store], 'readwrite');
    try {
      var res = transaction.objectStore(store).put(record);
      res.onsuccess = function(event) {
        success(record);
      };
      res.onerror = function(event) {
        error({error: "error storing record in db"});
      };
    } catch(e) { debugger; }
  },
  remove: function(store, key, success, error) {
    success = success || capabilities.dbman.success;
    error = error || capabilities.dbman.error;
    capabilities.dbman.find(store, key, function(res) {
      var id = capabilities.dbman.uniqify_key(res.id, store, 'id');
      capabilities.dbman.remove_internal(store, id, function() {
        success({id: key});
      }, error);
    }, function() {
      success({id: key});
    });
  },
  remove_internal: function(store, id, success, error) {
    var transaction = capabilities.db.transaction([store], 'readwrite');
    try {
      var res = transaction.objectStore(store).delete(id);
      res.onsuccess = function(event) {
        if(capabilities.dbman.deletes) {
          capabilities.dbman.deletes.push({id: id});
        }
        success({id: id});
      };
      res.onerror = function(event) {
        error({error: "error removing record in db"});
      };
    } catch(e) { debugger; }
  },
  clear: function(store, success, error) {
    success = success || capabilities.dbman.success;
    error = error || capabilities.dbman.error;

    var transaction = capabilities.db.transaction([store], 'readwrite');
    var res = transaction.objectStore(store).clear();
    res.onsuccess = function(event) {
      success({store: store});
    };
    res.onerror = function() {
      error({error: "error clearing store"});
    };
  },
  find_all: function(store, index, key, success, error) {
    success = success || capabilities.dbman.success;
    error = error || capabilities.dbman.error;
    key = capabilities.dbman.uniqify_key(key, store, index);
    var normalize = capabilities.dbman.normalize_record;
    capabilities.dbman.find_all_internal(store, index, key, function(list) {
      var new_list = [];
      list.forEach(function(record) {
        var new_result = {
          store: record.store,
          data: normalize(record.data, store)
        };
        new_list.push(new_result);
      });
      success(new_list);
    }, error);
  },
  find_all_internal: function(store, index, key, success, error) {

    var transaction = capabilities.db.transaction([store], 'readonly');
    var list = [];

    var s = transaction.objectStore(store);
    var res = s.openCursor();
    res.onsuccess = function(event) {
      var cursor = event.target.result;
      if(cursor) {
        if(!index || cursor.value[index] == key) {
          var data = cursor.value;
          list.push({
            store: store,
            data: data
          });
        }
        cursor.continue();
      } else {
        success(list);
      }
    };
    res.onerror = function() {
      error({error: "error retrieving records from db for " + store});
    };
  }
};

export default dbman;
