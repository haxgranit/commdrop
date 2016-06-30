# CoughDrop Changelog

## Master

### 2016-06-30
- lower volume for auditory scanning read-aloud
- user preference for text-above-images on buttons
- fix button stash, including new "add to stash" button in default mode
- new goals report in organization dashboard
- regular email updates on user usage reports, including goal tracking
- organizations can organize users into "rooms"
- extensions for Window-based acapela support (pending)
- new option to save report views as "snapshots" for side-by-side comparison

### 2016-06-06
- fix external links to open in default browser in the mobile app
- inline video player wouldn't close if the video failed to load
- more fine-grained options for copying and sharing boards
- fix lost/gained words user report
- framework for regular email notifications of usage summaries
- user-defined goals and progress tracking (feature flag)
- optimizations for board loading while syncing on mobile apps
- support for native sharing options on mobile apps
- additional sensor tracking added to usage logs
- video recording support added for log notes
- auto-transcoding of audio and video files (using SNS and elastic transcoder)
- more consistent syncing when reconnecting

### 2016-04-26
- first changelog entry
- move cached file contents out of the db to local file storage
- placeholder support for transcoding audio and videos
- improved caching support
- fixed bug that expired caches after 2 weeks without an update
- support for embedding boards via iframe