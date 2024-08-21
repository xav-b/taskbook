## Things to build

### Next

- [ ] IDEA Can i integrate the idea (or even base the project) on [outline speedrunning](https://learnhowtolearn.org/how-to-build-extremely-quickly/)
           Maybe just show how this can be used by using a board or tag and priorities

- [ ] FIXME config: if no `alias` section it crashes
- [ ] IDEA Implement `tb queue 1 2 3 5 ...` (create a board Queue and uses `queue` param to order them)
      -> `queue` new property integer
      -> `queue` command 
- [ ] FEAT Support scheduling in the future `tb task --on 2025-01-01/Tuesday`
- [ ] FIXME `--timer` capture CTRL-C and gracefully record the time spent.
- [ ] FIXME `tb b --timer` never completes

- [ ] IDEA Can a todo be a card (as a plugin)? Name is front, comment is solution. Check
           when reviewed and automatically uncheck according to schedule (maybe add a
           flag). Bind it to `@flashcard.{deck}`
        - [x] Create a card type
        - [ ] Review system
        - [ ] `card:decks` command to list decks (or can i hack on tb list? Using `tb list deck.*` fuzzy)
        - [ ] Replace `next: 3d` by last review

### Todo

### Backlog

- [ ] FEAT Support `tb delegate` which is like `delete` but keep track it was instead delegated, not cancelled
- [ ] FEAT At init, or `tb clear`, auto-check events from previous days
- [ ] FEAT calendar sync:
      - [ ] Auto-set to complete past events
      - [ ] Show time for event + tag t-short size
      - [ ] Implement `tb event:convert <task id> <schedule> [estimate]`
      - [ ] Fix token renewal (grant refused crash)
      - [x] Use `schedule` for task ordering on `calendar`
      - [ ] `event.reschedule` command, to update the datetime
      - [ ] Support calendar description as task comment, and `--notebook`
      - [ ] Also sync back to gcal
      - [x] `event.schedule` command to put a task on the calendar
      - [x] Support multiple calendars (`--calendar xx`) and use a different token file
- [ ] FEAT Have task link rendered and clickable
- [ ] FEAT ZSH Autocompletion (take example of the existing one)
- [ ] FEAT Storage: implement drizzle, sqlite and turso
- [ ] FEAT Undo previous action
- [ ] FEAT [Filter by priority](https://github.com/klaudiosinani/taskbook/pull/136)
- [ ] FEAT [Rename boards](https://github.com/klaudiosinani/taskbook/pull/73/files)
- [ ] FEAT Support ids range in the form of 3..7
- [ ] FEAT Support due date [PR #69](https://github.com/klaudiosinani/taskbook/pull/69)
- [ ] FEAT Recurrent
  - [x] Everyday it misses on the scheduling
  - [x] Recurrent tasks
  - [ ] Recurrent events
  - [ ] Validate value at creation (`on Mondays` parsing for example crashes)

- [ ] IDEA Prompt mode: shorten command (no more `tb`) and refresh on every input
- [ ] IDEA When moving tsomething to `@blocked`, indicate reason or other task(s) reference
- [ ] IDEA the `@tmp` board is automatically cleaned with `tb clear`
- [ ] IDEA Logger should both use `DEBUG` AND record stuff on file (rotating)
- [ ] IDEA Use taskbook to track those items, in the open on Github
- [ ] IDEA Exports/convert/import: json (done), markdown (for github sharing), sqlite dumb
- [ ] IDEA `archive` and `timeline` to support same filters as `tb list`
- [ ] IDEA `tb list` with dynamic sorting (prority, estimate (both should actually still combine))
- [ ] IDEA `schedule` command to put a task on the calendar (as event) (or `tb mv 2 @calendar --schedule 2pm`)
- [ ] IDEA Time boxing and pomodoro timer
- [ ] IDEA Hook system to implement a plugin system (post-delete, post-create, ...)
- [ ] IDEA Have a `theme` where colors and all are abstracted as `primary`, `secondary`, etc... (at the very least get the `grey` customised)
- [ ] IDEA The current output is just one FE - support TUI

- [ ] FIXME Logging to file was smarter. Either wway abstract it in `shared`
- [ ] FIXME storage loads by data types and must be modified for a new type
- [ ] FIXME boards and tags don't need to be stored with their `@` and `+`
- [ ] FIXME Restore of notes seem to move ids around and duplicate, if working at all
- [ ] FIXME install latest dependencies of chalk, clipboard and update-notifier
- [ ] FIXME Running `tb estimate` twice may create 2 t-shirt sizes
- [ ] FIXME Typing a wrong command and having all the boards returned is not helpful nor intuitive
- [ ] FIXME NaNm worked / NaNm estimated (or n.a.)
- [ ] FIXME `tb event` says `Created EventTask x` - re-implements a pretty `item._type`
- [ ] FIXME Replace all `throw` by proper rendering + `process.exit`

- [ ] TECH More performant - should be a feature
- [ ] TECH _groupByX should belong to Catalog
- [ ] TECH Make board names stored lower case, displayed title case (case insensitive basically) (`My Board` -> `my-board`)
- [ ] TECH `theme` from config (`grey` and `board title`)

---


### Library/Plugin system

The idea is to make Bullet Board a library. One can develop and import the
modules he wants, using the extensive supporting library, and build the
ultimate flexible task manager.

This would be organised as a mono repo, made of the core supporting library (a
package) and the plugins (also packages).

We would also ship:
- an utility to build a local cli out of custom plugins
- presets: core (`minimal` to the original taskbook, `bujo` that implements
Bullet Journal, and `extensive` bundling everything in the mono repo)

- [ ] Merge each `plugin.config` into a config singleton that is easy to import
- [x] FIXME: `focus` command is aware of `Goal`
- [ ] FIXME: `storage` is aware of every types
- [ ] Migrate Task and Note (but no need for packages, built-in)
- [ ] Make localjson a storage plugin
- [ ] Mono repo setup

---

### Workflow notes

- would/should/must + stash (up next) + backlog (that also includes notes, i.e.
  ideas that are not tasks) + blocked (...blocked) + evergreen (more for forever notes)
- `brag` tag to remember what to brag about
- `frog` and `s xs` tags to _eat the frog_ and tackle small things
- `pin` for stuff to always keep around

---

## Done

- [x] display stats option when using `tb list`
- [x] Tests
- [x] Support bragging (use a tag when completing or before, then `tb list brag` (need same for archive))
- [x] Option to link a new task to a goal from `tb task` (will be made easier supporting board by id)
- [x] Task points ([Issue #181](https://github.com/klaudiosinani/taskbook/issues/181)) -> use +xs +l...
- [x] Timeline to display done and pending (maybe not bad to keep archive/active segregation)
- [x] Blocked stage with visual cue (also dimmed, but different icon, and not affected by clear) (use `tbblock` alias)
- [x] Brag about tasks (use `tb c x y z +brag`)

- [x] Implementing habits
  - [x] `tb task --repeat "everyday"` (check that scheduling nodejs that uses many human cron inputs)
  - [x] Habits: just tag them, or `everyday` automatically gets the `habit` tag
  - [x] Have a way to detect first run of the day
  - [x] Go through all the tasks having a `repeat`, and create those of today that
        are not there already (+ have something fun about it, like a quote or whatever)
  - [x] Experiment with a daily "day planning" task

- [x] IDEA Move done tasks at the bottom of the boards show (settings though?)
- [x] `tb edit <property> <value...>` if nothing matches existing property, edit the title
- [x] `created task ##` could also show the description
- [x] FEAT Add `--notebook` to `tb note`
- [x] FEAT `tb begin --timer` will countdown the estimate with regular nudges
- [x] FEAT Have a recurrent icon hint
- [x] IDEA There should be `archive` (stuff done) and `trash` (stuff deleted)
- [x] FEAT `print` task to json and markdown
- [x] FEAT `tb t --notebook` will create the task AND open the comment
- [x] Sync today events from google calendar
- [x] FEAT Improve search: look into archive
- [x] FEAT Use estimates to compute unreasonable timeline (visual clue in the footer) - should be configurable
- [x] Support output json (task only now `--json`)
- [x] FIXME: `tb archive` is not ordered
- [x] FIXME: I can't see comments of archived items
- [x] Support `e:60` for estimates and durations
- [x] `tb check 34 --on 2023-12-24` `yesterday`
- [x] `tb tag` should take any number of ids and tags (just extract them from `+`)
- [x] Support estimates and time spent in the statistics at the bottom
- [x] render.check task to show the duration and estimate
- [x] `tb estimate` task
- [x] Support estimates (is null for event currently)
- [x] Logging
- [x] Namespaces
    - [x] Support namespaces (or taskbooks/books?)
    - [x] Support context switch
- [x] DDD structure
- [x] Typescript
- [x] Fix grey rendering on certain terminal themes
- [x] Duration: if the value is more than 3h, ask confirmation and offer to overwrite
- [x] Support [task id recycling](https://github.com/klaudiosinani/taskbook/issues/33)
- [x] Unix aliases: tb ls, rm, mv
- [x] Display duration in done task
- [x] Copy last id of certain commands
- [x] Parse `[ ]` and `[x]` to display subtasks count
- [x] `begin` and `focus` could track time
- [x] Support duration when checking a task
- [x] [Show timeline ordered by checked date](https://github.com/klaudiosinani/taskbook/issues/158) (this [should be supported](https://github.com/klaudiosinani/taskbook/pull/190))
- [x] Order boards view by priorities
- [x] `tb move` should behave like `tb task`, marking boards with `@` and allowing as many ids as we want
- [x] List boards (hacked it on `tb list`)
- [x] Support for goals + linking to tasks
- [x] Focus mode (`tb next`) with timer + display notes
- [x] Support for task notes (PR [#149](https://github.com/klaudiosinani/taskbook/pull/149) and Issue [#183](https://github.com/klaudiosinani/taskbook/issues/183))
- [x] Order boards in the order I list them
- [x] Make commands positional arguments
- [x] Support calendar timeline
- [x] FEAT Support syncing multiple calendars
  - [x] have them in their respective `calendar` `calendar.{name}` boards (or use tags?) 
  - [x] Sorting should also work
- [x] FEAT `tb edit` with no valid field should support any 
- [x] TECH Implement the library + plugin architecture
  - [x] Global config refactoring
- [x] IDEA Support git alias (and therefore custom workflows, like hiding)
- [x] IDEA Support multi line task creation(using quotes `tb t @must +tag "multi line comment"`)
- [x] FEAT support mutable and persistent state

---

## As A Service

- Collaborative: family (UI), pro teams
    - Github repositories can have collaborators - team shared boards
    - Have modular storage and use git, so there can be per-repository list of tasks
    - This would need an assignment too. Other tight integrations could be to
      have tasks completions linked to PR/commits
- Backup + Sync tasks between machines (using github repositories)
- Github repositories = workspaces
- Event hooks (integrate with IFTT/Zapier)
- Analytics
- Habits, tasks, scheduling, 2 ways sync with google calendar, time boxing
- Works offline
- Mobile
- Support for github, jira (boards are context, status are boards, etc...)

---

## Google Calendar integration

Guide: https://developers.google.com/calendar/api/quickstart/nodejs?authuser=1
Download `gapi-token.json` from https://console.cloud.google.com/apis/credentials?authuser=1&project=your-project

## Resources

- [Taskline](https://github.com/perryrh0dan/taskline#configuration)
