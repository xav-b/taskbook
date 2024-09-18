#!/usr/bin/env node

import { spawn } from 'child_process'
import { Command } from 'commander'
import updateNotifier from 'update-notifier'

import pkg from '../../package.json'
import render from './render'
import Logger from '../shared/logger'
import { parseDuration, parseDate } from '../shared/parser'
import EventPlugin from '../plugins/bb-domain-event/plugin'
import GoalPlugin from '../plugins/bb-domain-goal/plugin'
import CardPlugin from '../plugins/bb-domain-card/plugin'
import Taskbook, { showManual, switchContext } from '../use_cases/taskbook'
import config from '../config'

const log = Logger('ui.cli')
const program = new Command()
log.debug('instantiating Taskbook')
const taskbook = new Taskbook()

log.debug('registering commands')

program
  .command('what')
  .alias('w')
  .description('Usage examples')
  .action(() => showManual())

program
  .command('context:switch')
  .alias('cx')
  .description('Switch active context')
  .argument('context')
  .action((context: string) => switchContext(context))

program
  .command('hello')
  .alias('bonjour')
  .description('Initialise your day')
  .action(() => taskbook.hello())

// visualise tasks ---------------------------------------------------------------------

program
  .command('list')
  .alias('l')
  .alias('ls')
  .description('List items by attributes')
  .argument('[attributes...]')
  .action((attributes) => {
    const { data, groups } = taskbook.listByAttributes(attributes)

    const showTasks = attributes.length > 0
    const stats = data.stats()

    const tasksGrouped = data.groupByBoards(groups)
    // console.log('\n\n', groups, showTasks)
    // console.log('\n\n', groups['@stash'][0].toJSON(), showTasks)
    // console.log('\n\n', stats, '\n\n')

    render.displayByBoard(tasksGrouped, showTasks)
    render.displayStats(stats)
  })

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

    return taskbook.displayBoardStats()
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
  .option('-n, --notebook', 'Open editor to also insert a comment')
  .action((description, options) => taskbook.createNote(description, options.notebook))

program
  .command('task')
  .alias('t')
  .description('Create task')
  .argument('<description...>')
  .option('-e, --estimate [estimate]', 'estimated time to complete, in minutes')
  .option('-l, --link [link]', 'Bind a clickable link to the task')
  .option('-n, --notebook', 'Open editor to also insert a comment')
  .option('-j, --json', 'JSON output instead of console rendering')
  .option('-r, --repeat [repeat]', 'Make the task recurrent')
  .option('--on [date]', 'Schedule the task for later')
  .action((description, options) => {
    const estimate = parseDuration(options.estimate)
    // the `undefined` trick just avoids the function to manage both null and
    // undefined and keep a clean signature
    // TODO: at this point pass a `TaskCreateOptions`
    const tasks = taskbook.createTask(
      description,
      undefined,
      estimate || undefined,
      options.link,
      options.notebook,
      options.repeat
    )

    tasks.forEach((t) => {
      if (options.json) console.log(JSON.stringify({ id: t.id, created: t.toJSON() }))
      else render.successCreate(t)
    })
  })

// Tasks manage ------------------------------------------------------------------------

program
  .command('restore')
  .alias('r')
  .description('Restore items from archive')
  .argument('<items...>')
  .action((items) => {
    taskbook.restoreItems(items)
    render.successRestore(items)
  })

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
  .option('-t, --trash', 'send to trash bin instead of archive')
  .argument('<items...>')
  .action((items, options) => {
    taskbook.deleteItems(items, options.trash)
    render.successDelete(items)
  })

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
  .alias('E')
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
  .description('Edit item description/link/duration')
  .argument('task')
  .argument('property')
  .argument('<description...>') // description | link | duration (in minutes)
  .action((task, property, description) => {
    // NOTE: we don't intend to support all fields, like tags. That's because
    // a) they have their own command and b) it's unclear how e.g. boards
    // should be merged. And that complexity is more annoying than the small
    // benefit of editing several things at once (never useful to me)
    // TODO: duration
    // the properties not mentioned can be edited with more explicit/direct commands,
    // like `tb tag` or `tb estimate`
    const ITEM_PROPERTIES = ['description', 'link', 'duration']
    // equivalent of not specifying the property, which used to be the default
    // taskbook behaviour and a common use case
    if (!ITEM_PROPERTIES.includes(property)) {
      description = [property].concat(description)
      property = 'description'
    }
    taskbook.editItemProperty(task, property, description)
  })

// work --------------------------------------------------------------------------------

program
  .command('print')
  .alias('P')
  .description('display task details')
  .argument('task')
  .option('-f, --format [format]', 'output format', 'markdown')
  .option('-a, --archive', 'use achive instead of normal storage')
  .action((task, opts) => taskbook.printTask(task, opts.format, opts.archive))

program
  .command('begin')
  .alias('start')
  .alias('pause')
  .alias('b')
  .description('Start/pause task')
  .argument('task')
  .option('-t, --timer', 'block and start a countdown')
  .action((task, opts) => taskbook.beginTask(task, opts.timer))

program
  .command('copy')
  .alias('y')
  .description('Copy items description')
  .argument('itemid')
  .action((itemid) => taskbook.copyToClipboard(itemid))

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
  .action(() => taskbook.clear(config.local.clearNotes))

// default handler called when the command is not recognised
program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .argument('[alias]')
  .argument('[argv...]')
  .action((alias, argv) => {
    if (Object.keys(config.aliases).includes(alias)) {
      const cmd = config.aliases[alias].replace('$argv', argv.join(' '))
      log.info(`will run alias ${alias}`, cmd)
      spawn(cmd, { shell: true, stdio: 'inherit' })
    } else taskbook.displayBoardStats()
  })

// done --------------------------------------------------------------------------------

// register plugins
new EventPlugin().register(program, taskbook)
new GoalPlugin().register(program, taskbook)
new CardPlugin().register(program, taskbook)

log.debug('checking on updates')
updateNotifier({ pkg }).notify()

log.debug('parsing command line')
program.parse()

log.debug('completed')
