import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
import { fakeRecorder, fakeCanvas, queryLog, easyPromise, queue_promise } from 'frontend/tests/helpers/ember_helper';
import contentGrabbers from '../../utils/content_grabbers';
import editManager from '../../utils/edit_manager';
import persistence from '../../utils/persistence';
import app_state from '../../utils/app_state';
import stashes from '../../utils/_stashes';
import Ember from 'ember';

describe('videoGrabber', function() {
  it('should have specs', function() {
    expect(1).toEqual(2);
  });
});
