## Things to build

- [Taskline](https://github.com/perryrh0dan/taskline#configuration)

### Next

- ZSH Autocompletion (take example of the existing one)

### Fix behaviors

- Make board names stored lower case, displayed title case (case insensitive basically)
- `archive` and `timeline` to support same filters as `tb list`
- Event to understand time: entering `10am` should show up as `10:00am` and rightly align

### Ideas

- Have a `theme` where colors and all are abstracted as `primary`, `secondary`, etc...
- `@` to reference boards both by id and by name
- Time boxing and pomodoro timer
- Recurring tasks/habits: shall we use `@Tuesday`, ... and just have a command
  that automatically to today todo
- Use estimates to compute unreasonable timeline (in the footer)
- Support due date [PR #69](https://github.com/klaudiosinani/taskbook/pull/69)
- [Filter by priority](https://github.com/klaudiosinani/taskbook/pull/136)
- Hook system to implement a plugin system (post-delete, post-create, ...)
- [Rename boards](https://github.com/klaudiosinani/taskbook/pull/73/files)

### Logistics

- Write a nice documentation once stable
- Update readmes and others to reflect my project
- Publish a new package


---

## Done

- [x] display stats option when using `tb list`
- [x] Tests
- [x] Support bragging (use a tag when completing or before, then `tb list brag` (need same for archive))
- [x] Option to link a new task to a goal from `tb task` (will be made easier supporting board by id)
- [x] Task points ([Issue #181](https://github.com/klaudiosinani/taskbook/issues/181)) -> use +xs +l...
- [x] Timeline to display done and pending (maybe not bad to keep archive/active segregation)


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
- Habits, tasks, scheduling, 2 ways sync with google calendar
- Works offline

### Technical road

- Fix all the local stuff right now, go through TODO
- Finish refactoring (especailly private and public)
- Blog article on how I use it
- Make it work with Supabase
- Make Open source great: Documentation, new name, new npm package
