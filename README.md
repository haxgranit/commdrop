## CoughDrop - Every Voice Should Be Heard

CoughDrop is an open, web-based AAC (Augmentative and Alternative Communication) app. Basically
if people struggle getting their words out for whatever reason, they can use
the speech synthesis engine on a computing device to "speak" for them. Sometimes
they'll just type on a keyboard (think Stephen Hawking), but sometimes typing is too slow
or not a reasonable expectation, so communication
"boards", which are just grids of labeled pictures, can also be used. CoughDrop supports
building these grids and keyboards, optionally tracks their usage, and also offers
tools for the team supporting the communicator.

CoughDrop is web-based, and will run on most modern browsers. You can try it out
for free at https://www.mycoughdrop.com. It leverages modern web standards like the
Web Speech API, the Application Cache, IndexedDB and a bunch of HTML5 to work
both online and offline. It should run on Windows, Mac, ChromeOS, iOS and Android, and can
be packaged up for app stores as well.

Unlike most other AAC apps, which are installed and live on a single device, CoughDrop
is cloud-based, and syncs edits across multiple devices automatically. This may seem 
unimportant, but when you spend a lot of time building a very personalized vocabulary,
you don't want a broken device or a dead battery to prevent you from communicating. With
CoughDrop you can just log into a different device and keep going.

Additionally, CoughDrop allows users to add "supervisors", which are administrative
users that can help modify boards, track usage reports, and coordinate strategy. In the
past users would have to hand over their device so therapists or parents could make
changes or review usage logs, but with CoughDrop supervisors can do their thing on their
own devices. And permission controls always stay in the hands of the user.

Anyway, that's CoughDrop in a nutshell. The code is open source so you're free to
run it yourself. We require a code contributor agreement before accepting changes into
our repo. Boards created in CoughDrop use the Open Board Format (http://www.openboardformat.org)
so they should export/import across instances of CoughDrop and a few other systems
without having to dig around in the database.

### Technical Notes

CoughDrop has a Rails backend (`/`) and an Ember frontend (`/app/frontend`), which are both contained in this
repository. If you're familiar with those frameworks then hopefully nothing here will
embarrass me too much -- I mean, hopefully you'll be able to pick up pretty quickly
the basic makeup of the app. These notes are not comprehensive, Feel free to help
me flesh them out if that's your thing.

The frontend and backend communicate via the open and completely-undocumented API.

The backend relies on Redis and Postgres both being installed. It might mostly work
without Redis, but I that probably won't be true for much longer. Also there are a 
number of assumed environment variables (eventually I'd love to make some of these
optional, but right now there's no guaranteeing what will happen if they aren't set),
you can see them listed out in `.env.example`.

You'll also need to configure Postgres using `database.yml` or something similar.

You can use foreman to run the server, worker and ember watcher at the same time.

### License

Licensed under the AGPLv3 license.
