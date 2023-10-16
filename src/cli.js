#!/usr/bin/env node

const { Command } = require('commander')
const updateNotifier = require('update-notifier')

const pkg = require('../package.json')
const taskbook = require('./taskbook')

const program = new Command()

// TODO: group commands logically together
program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .action(() => {
    taskbook.displayByBoard()

    return taskbook.displayStats()
  })

program
  .command('list')
  .alias('l')
  .description('List items by attributes')
  .argument('[attributes...]')
  .action((attributes) => taskbook.listByAttributes(attributes))

program
  .command('archive')
  .alias('a')
  .description('display archived items')
  .action(() => taskbook.displayArchive())

program
  .command('restore')
  .alias('r')
  .description('Restore items from archive')
  .argument('<items...>')
  .action((items) => taskbook.restoreItems(items))

program
  .command('note')
  .alias('n')
  .description('Create note')
  .argument('<description...>')
  .action((description) => taskbook.createNote(description))

// NOTE: support duration as a markup? Like `last:30m`
program
  .command('event')
  .alias('E')
  .description('Create event')
  .argument('schedule')
  .argument('duration')
  .argument('<description...>')
  .action((schedule, duration, description) =>
    // TODO: support `schedule` as a datetime, and trick the system of creation date
    // so by default w display today's events
    taskbook.createEvent(schedule, description, duration)
  )

program
  .command('task')
  .alias('t')
  .description('Create task')
  .argument('<description...>')
  .action((description) => taskbook.createTask(description))

program
  .command('comment')
  .alias('z')
  .description('Comment on an item')
  .argument('item')
  .action((item) => taskbook.comment(item))

program
  .command('tag')
  .description('Add a tag to an item')
  .argument('itemid')
  .argument('<tags...>')
  .action((itemid, tags) => {
    taskbook.tagItem(itemid, tags)
  })

program
  .command('goal')
  .alias('g')
  .description('Create a new goal')
  .argument('<description...>')
  .action((description) => taskbook.createGoal(description))

program
  .command('toward')
  .description('Link tasks to a goal')
  .argument('goal')
  .argument('<tasks...>')
  .action((goal, tasks) =>
    taskbook.linkToGoal(
      goal,
      tasks.map((x) => parseInt(x.trim(), 10))
    )
  )

program
  .command('focus')
  .description('Start working on a task')
  .argument('task')
  .action((task) => taskbook.focus(task))

program
  .command('delete')
  .alias('d')
  .description('Delete items')
  .argument('<items...>')
  .action((items) => taskbook.deleteItems(items))

program
  .command('check')
  .alias('c')
  .description('Check/uncheck task')
  .argument('<tasks...>')
  .action((tasks) => taskbook.checkTasks(tasks))

// TODO: only allow one task
program
  .command('begin')
  .alias('start')
  .alias('pause')
  .alias('b')
  .description('Start/pause task')
  .argument('<tasks...>')
  .action((tasks) => taskbook.beginTasks(tasks))

program
  .command('star')
  .alias('s')
  .description('Star/unstar items')
  .argument('<items...>')
  .action((items) => taskbook.starItems(items))

program
  .command('copy')
  .alias('y')
  .description('Copy items description')
  .argument('<items...>')
  .action((items) => taskbook.copyToClipboard(items))

program
  .command('timeline')
  .alias('i')
  .description('Display timeline view')
  .action(() => {
    taskbook.displayByDate()

    return taskbook.displayStats()
  })

program
  .command('priority')
  .alias('p')
  .description('Update priority of task')
  .argument('priority')
  .argument('<tasks...>')
  .action((priority, tasks) => {
    // tag the tasks with `@`
    tasks = tasks.map((each) => `@${each}`)

    taskbook.updatePriority(tasks.concat(priority))
  })

program
  .command('find')
  .alias('f')
  .description('Search for items')
  .argument('<terms...>')
  .action((terms) => taskbook.findItems(terms))

program
  .command('edit')
  .alias('e')
  .description('Edit item description')
  .argument('task')
  .argument('<description...>')
  .action((task, description) => taskbook.editDescription([`@${task}`].concat(description)))

program
  .command('move')
  .alias('m')
  .description('Move item between boards')
  .argument('task')
  .argument('<boards...>')
  .action((task, boards) => taskbook.moveBoards([`@${task}`].concat(boards)))

program
  .command('clear')
  .description('Archive all checked items')
  .action(() => taskbook.clear())

updateNotifier({ pkg }).notify()

program.parse()
