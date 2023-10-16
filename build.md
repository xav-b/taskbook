## Things to build (in order)


### New Features

- Have a warning when new boards/tags are created

- Recurring tasks/habits: shall we use `@Tuesday`, ... and just have a command
  that automatically to today todo
- Support task scheduling (should show up by themselves on the right day). 
- `begin` and `focus` could track time
- Use estimates to compute unreasonable timeline (in the footer)
- log of everything that had been done (with auto timing)
  Every view should be today, except `archive` command
- Support due date [PR #69](https://github.com/klaudiosinani/taskbook/pull/69)


### Fix behaviors

- `tb move` should behave like `tb task`, marking boards with `@` and allowing as many ids as we want
- Order boards view by priorities

- [Show timeline ordered by checked date](https://github.com/klaudiosinani/taskbook/issues/158) (this [should be supported](https://github.com/klaudiosinani/taskbook/pull/190))
  I need a view of what has been done the past week
- `archive` and `timeline` to filter by boards

### Ideas

- Copy to clipboard the last `id` (like from `tb task`)
- Support queueing (linked to next since completing one leads to the next)
- Support both `@name` and `@id`
- Time boxing and pomodoro timer
- Have a way to document one's workflow

### Logistics

- Use more the `config`
- Refactor and typescript
- Update readmes and others to reflect my project
- Publish a new package

- [x] Option to link a new task to a goal from `tb task` (will be made easier supporting board by id)
- [x] Task points ([Issue #181](https://github.com/klaudiosinani/taskbook/issues/181)) -> use +xs +l...

- [x] List boards (hacked it on `tb list`)
- [x] Support for goals + linking to tasks
- [x] Focus mode (`tb next`) with timer + display notes
- [x] Support for task notes (PR [#149](https://github.com/klaudiosinani/taskbook/pull/149) and Issue [#183](https://github.com/klaudiosinani/taskbook/issues/183))
- [x] Order boards in the order I list them
- [x] Make commands positional arguments
- [x] Support calendar timeline

---

## As A Service

- Terminal first class citizen
- Backup + Sync tasks between machines (using github repositories)
- Github repositories = namespaces
- Github repositories can have collaborators - team shared boards
- Event hooks
- Analytics out of the logs
