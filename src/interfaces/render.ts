import chalk from 'chalk'

import { sortByPriorities } from '../shared/utils'
// TODO: import { Item, Note, Goal, Task } from '../domain'
import Item from '../domain/item'
import Note from '../domain/goal'
import Goal from '../domain/goal'
import Task, { TaskPriority } from '../domain/task'
import EventTask from '../domain/event'
import { error, log, success, warn } from './printer'
import config, { IConfig } from '../config'

const { blue, green, magenta, red, yellow } = chalk
// TODO: should be accessible from configuration
const grey = chalk.cyan.dim

/**
 * TODO: Road to configurable theme
 * 1. Replace labels with below theme (like `theme.p2`)
 * 2. Have a js way to swap theme: `const theme = config.theme()`
 * 3. Offer a way in config to overwrite any individual property, from json
 * 4. Have pre-defined theme and a way to pick them
 *
const theme = {
  blue,
  grey,
  magenta,
  red,
  underline,
  done: green,
  wip: yellow,
  p2: yellow,
  p3: red,
  error: red,
  warning: yellow,
}
 */

function _getItemStats(items: Item[]) {
  let [tasks, complete, notes] = [0, 0, 0]

  items.forEach((item) => {
    if (item.isTask) {
      tasks++
      if (item instanceof Task && item.isComplete) {
        return complete++
      }
    }

    // FIXME: that kind of work by accident, and we may want to represent
    // other types like goals and events.
    return notes++
  })

  return { tasks, complete, notes }
}

class Render {
  _configuration: IConfig

  constructor() {
    this._configuration = config.get()
  }

  _colorBoards(boards: string[]) {
    return boards.map((x) => grey(x)).join(' ')
  }

  _isBoardComplete(items: Item[]) {
    const { tasks, complete, notes } = _getItemStats(items)
    return tasks === complete && notes === 0
  }

  private _getStar(item: Item) {
    return item.isStarred ? yellow('★') : ''
  }

  _getCommentHint(item: Item) {
    return item.comment ? blue('✎') : ''
  }

  _buildTitle(key: string, items: Item[]) {
    let title = this._configuration.highlightTitle(key)
    if (key === new Date().toDateString()) title += ` ${grey('[Today]')}`

    const { tasks, complete } = _getItemStats(items)
    const correlation = grey(`[${complete}/${tasks}]`)

    return { title, correlation }
  }

  _buildPrefix(item: Item) {
    const prefix = []

    const { id } = item

    prefix.push(' '.repeat(4 - String(id).length))
    prefix.push(grey(`${id}.`))

    return prefix.join(' ')
  }

  _buildTaskMessage(item: Task): string {
    const message = []

    const { isComplete, description } = item

    if (!isComplete && item.priority > 1) {
      const style = this._configuration.priorities[item.priority]
      message.push(style(description))
    } else {
      message.push(isComplete ? grey(description) : description)
    }

    if (!isComplete && item.priority > 1)
      message.push(item.priority === 2 ? yellow('(!)') : red('(!!)'))

    return message.join(' ')
  }

  _buildNoteMessage(item: Item): string {
    return item.description
  }

  _displayTitle(board: string, items: Item[]) {
    const { title: message, correlation: suffix } = this._buildTitle(board, items)
    const titleObj = { prefix: '\n ', message, suffix }

    return log(titleObj)
  }

  displayItemByBoard(item: Item) {
    const { _type, tags } = item

    const age = item.age()
    const star = this._getStar(item)
    const comment = this._getCommentHint(item)
    const suffix = []
    let message = ''

    const prefix = this._buildPrefix(item)

    if (item instanceof Task) message = this._buildTaskMessage(item)
    else message = this._buildNoteMessage(item)

    if (age !== 0) suffix.push(grey(`${age}d`))
    if (star) suffix.push(star)
    if (comment.length > 0) suffix.push(comment)

    if (item instanceof Task) {
      const { duration, isComplete } = item
      if (duration && duration > 0 && isComplete) {
        // convert to minutes
        let prettyDuration = ''
        const minutes = duration / (1000 * 60)
        if (minutes > 60) prettyDuration = `${Math.ceil(minutes / 60)}h`
        else prettyDuration = `${minutes}m`

        suffix.push(grey(prettyDuration))
      }
    }

    if (tags?.length > 0) suffix.push(grey(tags.join(' ')))

    const msgObj = { prefix, message, suffix: suffix.join(' ') }

    if (item instanceof Note) return item.display(msgObj)
    if (item instanceof Goal) return item.display(msgObj)
    if (item instanceof EventTask) return item.display(msgObj)
    // finish up by `Task` since a lot of other types inherits from it and
    // therefor `instanceof Task` is true!
    if (item instanceof Task) return item.display(msgObj)

    throw new Error(`item of type ${_type} is not supported`)
  }

  _displayItemByDate(item: Item) {
    const boards = item.boards.filter((x) => x !== this._configuration.defaultBoard)
    const star = this._getStar(item)

    const prefix = this._buildPrefix(item)
    let message = ''
    if (item instanceof Task) message = this._buildTaskMessage(item)
    else message = this._buildNoteMessage(item)

    const suffix = []

    if (item instanceof Task) {
      if (item.duration && item.duration > 0 && item.isComplete)
        suffix.push(grey(`${Math.ceil(item.duration / (1000 * 60))}m`))
    }

    suffix.push(this._colorBoards(boards))
    suffix.push(star)

    const msgObj = { prefix, message, suffix: suffix.join(' ') }

    if (item instanceof Note) return item.display(msgObj)
    if (item instanceof Goal) return item.display(msgObj)
    if (item instanceof EventTask) return item.display(msgObj)
    if (item instanceof Task) return item.display(msgObj)

    throw new Error(`item of type ${item._type} is not supported`)
  }

  displayByBoard(data: Record<string, Item[]>, displayTasks = true) {
    Object.keys(data).forEach((board: string) => {
      if (this._isBoardComplete(data[board]) && !this._configuration.displayCompleteTasks) return

      this._displayTitle(board, data[board])

      // TODO: allow other sorting strategies (default by id)
      data[board].sort(sortByPriorities).forEach((item) => {
        if (!displayTasks) return
        if (item instanceof Task && item.isComplete && !this._configuration.displayCompleteTasks)
          return

        this.displayItemByBoard(item)
      })
    })
  }

  displayByDate(data: Record<string, Item[]>) {
    Object.keys(data).forEach((date) => {
      if (this._isBoardComplete(data[date]) && !this._configuration.displayCompleteTasks) {
        return
      }

      this._displayTitle(date, data[date])

      data[date].forEach((item) => {
        if (item instanceof Task && item.isComplete && !this._configuration.displayCompleteTasks) {
          return
        }

        this._displayItemByDate(item)
      })
    })
  }

  displayStats(opts: { complete?: number; inProgress?: number; pending?: number; notes?: number }) {
    if (!this._configuration.displayProgressOverview) {
      return
    }

    const complete = opts.complete || 0
    const inProgress = opts.inProgress || 0
    const pending = opts.pending || 0
    const notes = opts.notes || 0
    const percent = Math.floor(100 * (complete / (inProgress + pending + complete)))

    const prettyPercent =
      percent >= 75 ? green(`${percent}%`) : percent >= 50 ? yellow(`${percent}%`) : `${percent}%`

    const status = [
      `${green(String(complete))} ${grey('done')}`,
      `${blue(String(inProgress))} ${grey('in-progress')}`,
      `${magenta(String(pending))} ${grey('pending')}`,
      `${blue(String(notes))} ${grey(notes === 1 ? 'note' : 'notes')}`,
    ]

    if (complete !== 0 && inProgress === 0 && pending === 0 && notes === 0) {
      log({ prefix: '\n ', message: 'All done!', suffix: yellow('★') })
    }

    if (pending + inProgress + complete + notes === 0) {
      log({ prefix: '\n ', message: 'Type `tb --help` to get started!', suffix: yellow('★') })
    }

    log({ prefix: '\n ', message: grey(`${prettyPercent} of all tasks complete.`) })
    log({ prefix: ' ', message: status.join(grey(' · ')), suffix: '\n' })
  }

  invalidCustomAppDir(path: string) {
    const [prefix, suffix] = ['\n', red(path)]
    const message = 'Custom app directory was not found on your system:'
    error({ prefix, message, suffix })
  }

  invalidID(id: string) {
    const [prefix, suffix] = ['\n', grey(id)]
    const message = 'Unable to find item with id:'
    error({ prefix, message, suffix })
  }

  invalidIDsNumber() {
    const prefix = '\n'
    const message = 'More than one ids were given as input'
    error({ prefix, message })
  }

  invalidPriority() {
    const prefix = '\n'
    const message = 'Priority can only be 1, 2 or 3'
    error({ prefix, message })
  }

  markComplete(ids: string[]) {
    if (ids.length === 0) return

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Checked ${ids.length > 1 ? 'tasks' : 'task'}:`
    success({ prefix, message, suffix })
  }

  markIncomplete(ids: string[]) {
    if (ids.length === 0) return

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Unchecked ${ids.length > 1 ? 'tasks' : 'task'}:`
    success({ prefix, message, suffix })
  }

  markStarted(ids: string[]) {
    if (ids.length === 0) {
      return
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Started ${ids.length > 1 ? 'tasks' : 'task'}:`
    success({ prefix, message, suffix })
  }

  markPaused(ids: string[]) {
    if (ids.length === 0) return

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Paused ${ids.length > 1 ? 'tasks' : 'task'}:`
    success({ prefix, message, suffix })
  }

  markStarred(ids: string[]) {
    if (ids.length === 0) {
      return
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Starred ${ids.length > 1 ? 'items' : 'item'}:`
    success({ prefix, message, suffix })
  }

  markUnstarred(ids: string[]) {
    if (ids.length === 0) {
      return
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Unstarred ${ids.length > 1 ? 'items' : 'item'}:`
    success({ prefix, message, suffix })
  }

  missingBoards() {
    const prefix = '\n'
    const message = 'No boards were given as input'
    error({ prefix, message })
  }

  missingDesc() {
    const prefix = '\n'
    const message = 'No description was given as input'
    error({ prefix, message })
  }

  missingID() {
    const prefix = '\n'
    const message = 'No id was given as input'
    error({ prefix, message })
  }

  warning(id: number, message: string) {
    if (!this._configuration.displayWarnings) return

    const suffix = grey(String(id))
    warn({ message: yellow(message), suffix })
  }

  successCreate(item: Item) {
    const [prefix, suffix] = ['\n', grey(String(item.id))]
    const message = `Created ${item._type}`
    success({ prefix, message, suffix })
  }

  successEdit(id: string) {
    const [prefix, suffix] = ['\n', grey(id)]
    const message = 'Edited item:'
    success({ prefix, message, suffix })
  }

  successDelete(ids: string[]) {
    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Deleted ${ids.length > 1 ? 'items' : 'item'}:`
    success({ prefix, message, suffix })
  }

  successMove(id: string, boards: string[]) {
    const [prefix, suffix] = ['\n', grey(boards.join(', '))]
    const message = `Move item: ${grey(id)} to`
    success({ prefix, message, suffix })
  }

  successPriority(id: string, level: TaskPriority) {
    const prefix = '\n'
    const message = `Updated priority of task: ${grey(id)} to`
    const suffix = level === 3 ? red('high') : level === 2 ? yellow('medium') : green('normal')
    success({ prefix, message, suffix })
  }

  successRestore(ids: string[]) {
    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Restored ${ids.length > 1 ? 'items' : 'item'}:`
    success({ prefix, message, suffix })
  }

  successCopyToClipboard(ids: string[]) {
    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Copied the ${
      ids.length > 1 ? 'descriptions of items' : 'description of item'
    }:`
    success({ prefix, message, suffix })
  }

  successSwitchContext(name: string) {
    const [prefix, suffix] = ['\n', grey(name)]
    const message = 'Switched context'
    success({ prefix, message, suffix })
  }
}

export default new Render()
