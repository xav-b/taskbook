## Things to build

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
- [ ] FIXME: `focus` command is aware of `Goal`
- [ ] FIXME: `storage` is aware of every types
- [ ] Migrate Task and Note (but no need for packages, built-in)
- [ ] Make localjson a storage plugin
- [ ] Mono repo setup

### Schedule of task

For timeboxing technic + calendar event uniformisation, make `schedule` a task thing. Then:
- Any task can be scheduled: there's a `tb schedule {id} 10AM` and `tb task --schedule 10AM`
- Make all those and `tb event` to understand it as a date
- Implement it as a sorting strategy
- `event` plugin to support event view (like today) and calendar (all scheduled tasks)

### FIXME

- [ ] `tb event` says `Created EventTask x` - re-implements a pretty `item._type`

### Next

- Support `e:60` and `d:60` for estimates and durations
- `archive` and `timeline` to support same filters as `tb list`
- Implement the library + plugin architecture
- `edit` command to consolidate description, comment, tag, board, estimate, duration, ...
- `theme` from config (`grey` and `board title`)
- Schedule to understand time: entering `10am` should show up as `10:00am` and rightly align. Also support `--estimate` as t-shirt sizes
- Replace all `throw` by proper rendering + `process.exit`

### Technicalities

- More performant - should be a feature
- _groupByX should belong to Catalog
- Make board names stored lower case, displayed title case (case insensitive basically)

### Ideas

- `tb task` and `tb tag` should set estimate when given t-shirt sizes
- Support ids range in the form of 3..7
- Blocked stage with visual cue (also dimmed, but different icon, and not affected by clear)
- `calendar` should organise by time (once we have time understood)
- Storage: implement drizzle, sqlite and turso
- Support duration and estimate markers in addition to cli flags
- ZSH Autocompletion (take example of the existing one)
- Have a `theme` where colors and all are abstracted as `primary`, `secondary`, etc... (at the very least get the `grey` customised)
- Time boxing and pomodoro timer
- Recurring tasks/habits: shall we use `@Tuesday`, ... and just have a command
  that automatically adds to today todo
- Use estimates to compute unreasonable timeline (in the footer)
- Support due date [PR #69](https://github.com/klaudiosinani/taskbook/pull/69)
- [Filter by priority](https://github.com/klaudiosinani/taskbook/pull/136)
- Hook system to implement a plugin system (post-delete, post-create, ...)
- [Rename boards](https://github.com/klaudiosinani/taskbook/pull/73/files)
- Undo previous action
- `schedule` command to put a task on the calendar (as event) (or `mv 2 @calendar --schedule 2pm`)
- `goal` should be a kind of extension/plugin
  - [x] task of type goal
  - [x] different rendering
  - command `goal` command creates them
  - command `toward` stars an item and tag it
  - Can try to implement `habit` like this
- `tb find` could look accross archive too

### Workflow notes

- would/should/must + stash (up next) + backlog (that also includes notes, i.e.
  ideas that are not tasks) + blocked (...blocked)


---

## Done

- [x] display stats option when using `tb list`
- [x] Tests
- [x] Support bragging (use a tag when completing or before, then `tb list brag` (need same for archive))
- [x] Option to link a new task to a goal from `tb task` (will be made easier supporting board by id)
- [x] Task points ([Issue #181](https://github.com/klaudiosinani/taskbook/issues/181)) -> use +xs +l...
- [x] Timeline to display done and pending (maybe not bad to keep archive/active segregation)

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

- [Taskline](https://github.com/perryrh0dan/taskline#configuration)
