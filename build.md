## Things to build

### Fix behaviors

- Merge event `duration` and all items `_duration`
- FIXME: tb archive doesn't order the boards by time DESC
- `archive` and `timeline` to support same filters as `tb list`

### Ideas

- Have a `theme` where colors and all are abstracted as `primary`, `secondary`, etc...
- Config: support env variables + type it
- Support namespaces (or taskbooks/books?)
- `@` to reference boards both by id and by name
- Time boxing and pomodoro timer
- Recurring tasks/habits: shall we use `@Tuesday`, ... and just have a command
  that automatically to today todo
- Use estimates to compute unreasonable timeline (in the footer)
- Support due date [PR #69](https://github.com/klaudiosinani/taskbook/pull/69)

### Logistics

- not too sure about bun yet
- Refactor and typescript
- Update readmes and others to reflect my project
- Publish a new package

---

## Done

- [x] Option to link a new task to a goal from `tb task` (will be made easier supporting board by id)
- [x] Task points ([Issue #181](https://github.com/klaudiosinani/taskbook/issues/181)) -> use +xs +l...
- [x] Timeline to display done and pending (maybe not bad to keep archive/active segregation)

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

- Backup + Sync tasks between machines (using github repositories)
- Github repositories = namespaces
- Github repositories can have collaborators - team shared boards
- Event hooks (integrate with IFTT/Zapier)
- Analytics out of the logs
- Habits, tasks, scheduling, 2 ways sync with google calendar
