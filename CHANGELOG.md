# CoughDrop Changelog

## Master

### 2017-01-27
- fixes for goals/badges browsing and selection interfaces
- option to faintly show hidden buttons in speak mode
- interface to swap images in batch (feature flag)
- backend support for batch translations (feature flag)
- fix issue with logs not going to supervisees correctly

### 2017-01-13
- show badge completion requirements for all badge popups
- fixes for race conditions when updating users and boards
- sound effects for badges
- support for frame-rendered integrations, with callbacks via aac_shim

### 2016-12-21
- fixed region-based scanning, added button-based scanning option
- optional alternate voice for scanning audio prompts
- support for generic place-based triggers on sidebar boards
- track limited daily use for all users, even when logging is disabled
- fix edited svgs not rendering correctly
- upgrade ember, rails and related libraries
- allow text-on-top for pdfs

### 2016-11-28
- improved goals, including badge generation (feature flag)
- got rid of "subscription" wording most places
- support for modeling actions that don't affect user logs (feature flag)
- location-based sidebar updates (feature flag)
- filter profanity on keyboard word suggestions

### 2016-10-27
- improved goal management interface
- room-level usage stats page
- support for pasting images onto buttons
- option to make boards public when copying
- option to translate boards when copying (feature flag)

### 2016-10-12
- fix dwell-based selection issues
- fix recurring notification scheduling
- more details on sync results
- more reliable syncing based on updates
- enable video recording for log messages
- introduction walkthrough for new users
- improve goals interface (feature flag)
- html sanitization for some fields
- support multiple image repositories for symbol search

### 2016-09-03
- support for Windows-based electron install
- more configuration options for dwell tracking
- support for searching multiple symbol/image libraries

### 2016-08-15
- user-level integrations that can be triggered by board button presses (feature flag)
- setting to block emails from future registrations
- fixed dwell tracking to work regardless of touch/click settings
- show board hierarchy on "Board Details" modal
- better consistency for subscription notifications
- enable snapshots, side-by-side reports for all users

### 2016-06-30
- lower volume for auditory scanning read-aloud
- user preference for text-above-images on buttons
- fix button stash, including new "add to stash" button in default mode
- new goals report in organization dashboard
- regular email updates on user usage reports, including goal tracking
- organizations can organize users into "rooms"
- extensions for Window-based acapela support (pending)
- new option to save report views as "snapshots" for side-by-side comparison (feature flag)

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