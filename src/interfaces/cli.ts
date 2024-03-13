#!/usr/bin/env node

import { Command } from 'commander'
import updateNotifier from 'update-notifier'

import pkg from '../../package.json'
import render from '../interfaces/render'
import { parseDuration, parseDate } from '../shared/parser'
import EventPlugin from '../plugins/bb-domain-event/plugin'
import GoalPlugin from '../plugins/bb-domain-goal/plugin'
import Taskbook from '../use_cases/taskbook'

const program = new Command()
const taskbook = new Taskbook()

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
  .command('what')
  .alias('w')
  .description('Usage examples')
  .action(() => taskbook.showManual())

program
  .command('context:switch')
  .alias('cx')
  .description('Switch active context')
  .argument('context')
  .action((context: string) => taskbook.switchContext(context))

// visualise tasks ---------------------------------------------------------------------

program
  .command('list')
  .alias('l')
  .alias('ls')
  .description('List items by attributes')
  .argument('[attributes...]')
  .action((attributes) => taskbook.listByAttributes(attributes))

program
  .command('archive')
  .alias('a')
  .description('display archived items')
  .action(() => taskbook.displayArchive())

program
  .command('timeline')
  .alias('i')
  .description('Display timeline view')
  .action(() => {
    taskbook.displayByDate()

    return taskbook.displayStats()
  })

program
  .command('find')
  .alias('f')
  .description('Search for items')
  .argument('<terms...>')
  .option('-a, --archive', 'look into archive')
  .action((terms, opts) => taskbook.findItems(terms, opts.archive))

// Tasks create ------------------------------------------------------------------------

program
  .command('note')
  .alias('n')
  .description('Create note')
  .argument('<description...>')
  .action((description) => taskbook.createNote(description))

program
  .command('task')
  .alias('t')
  .description('Create task')
  .argument('<description...>')
  .option('-e, --estimate [estimate]', 'estimated time to complete, in minutes')
  .option('-l, --link [link]', 'Bind a clickable link to the task')
  .option('-n, --notebook', 'Open editor to also insert a comment')
  .option('-j, --json', 'json output instead of console rendering')
  .action((description, options) => {
    const estimate = parseDuration(options.estimate)
    // the `undefined` trick just avoids the function to manage both null and
    // undefined and keep a clean signature
    taskbook.createTask(
      description,
      estimate || undefined,
      options.link,
      options.notebook,
      options.json
    )
  })

// Tasks manage ------------------------------------------------------------------------

program
  .command('restore')
  .alias('r')
  .description('Restore items from archive')
  .argument('<items...>')
  .action((items) => taskbook.restoreItems(items))

program
  .command('comment')
  .alias('z')
  .description('Comment on an item')
  .argument('item')
  .action((item) => taskbook.comment(item))

program
  .command('tag')
  .description('Add a tag to an item')
  .argument('<description...>')
  .action((description) => {
    taskbook.tagItem(description)
  })

program
  .command('delete')
  .alias('d')
  .alias('rm')
  .description('Delete items')
  .argument('<items...>')
  .action((items) => taskbook.deleteItems(items))

program
  .command('check')
  .alias('c')
  .description('Check/uncheck task')
  .argument('<tasks...>')
  .option('-d, --duration [duration]', 'time to complete, in minutes')
  .option('--on [completion]', 'Overwrite completion date')
  .action((tasks, options) => {
    const duration = parseDuration(options.duration)
    const doneAt = options.on && parseDate(options.on)
    taskbook.checkTasks(tasks, duration, doneAt)
  })

program
  .command('star')
  .alias('s')
  .description('Star/unstar items')
  .argument('<items...>')
  .action((items) => taskbook.starItems(items))

program
  .command('estimate')
  .alias('s')
  .description('Set task estimate in minutes')
  .argument('taskid')
  .argument('estimate')
  .action((taskid, estimate) => {
    const estimateMs = parseDuration(estimate)
    if (!estimateMs) throw new Error(`failed to parse estimate: ${estimate}`)

    taskbook.estimateWork(taskid, estimateMs)
  })

program
  .command('priority')
  .alias('p')
  .description('Update priority of task')
  .argument('priority', 'Tasks new priority')
  .argument('<tasks...>')
  .action((priority, tasks) => {
    // NOTE: could not figure out how to make Caporal `validator` to work

    // TODO: validate against PriorityLevel type
    if (!['1', '2', '3'].includes(priority)) {
      render.invalidPriority()
      process.exit(1)
    }

    taskbook.updatePriority(parseInt(priority), tasks)
  })

program
  .command('edit')
  .alias('e')
  .description('Edit item description')
  .argument('task')
  .argument('<description...>')
  .action((task, description) => taskbook.editDescription([`@${task}`].concat(description)))

// work --------------------------------------------------------------------------------

// TODO: merge with begin
program
  .command('focus')
  .alias('F')
  .description('Start working on a task')
  .argument('task')
  .option('-a, --archive', 'use achive instead of normal storage')
  .action((task, opts) => taskbook.focus(task, opts.archive))

program
  .command('begin')
  .alias('start')
  .alias('pause')
  .alias('b')
  .description('Start/pause task')
  .argument('task')
  .action((task) => taskbook.beginTask(task))

program
  .command('copy')
  .alias('y')
  .description('Copy items description')
  .argument('<items...>')
  .action((items) => taskbook.copyToClipboard(items))

// board -------------------------------------------------------------------------------

program
  .command('move')
  .alias('m')
  .alias('mv')
  .description('Move item between boards')
  .argument('<input...>')
  .action((input) => taskbook.moveBoards(input))

program
  .command('clear')
  .description('Archive all checked items')
  .action(() => taskbook.clear())

// register plugins
new EventPlugin().register(program, taskbook)
new GoalPlugin().register(program, taskbook)

updateNotifier({ pkg }).notify()

program.parse()
