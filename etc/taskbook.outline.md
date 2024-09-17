# Ship Taskbook

I can actually comment as much as I want, this will be ignored, but can provide
useful context

Top levels are boards, under which we have (actual) tasks, and finally subtasks
(as comments of the tasks).
Task level supports the same syntax as the cli, i.e. priority, estimate, etc...

- More versatile storage
  - Have a `.getUnique` on the interface p:2
  - Implement archive and bin at the storage level p:2
  - Have a storage switch from config e:30
  - storage to have their config space +foo +bar
  - Implement more storages
    - Implement SQLite
    - Implement Redis
    - Migration script
- Packaging
  - Settle on a name and npm package
  - Publish `@tasbook/core` and `@tasbook/cli`
  - Package UDP and TCP servers as a standalone example of core package
- Outline
  - Implement subtask
- Go to market
  - Setup jsoncrack and related services (clerk, supabase)
  - Have key features
  - Package Free and simple sync
