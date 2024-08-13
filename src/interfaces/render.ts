import chalk from 'chalk'
import { parse, compareAsc } from 'date-fns'

import { msToMinutes } from '../shared/utils'
// TODO: import { Item, Note, Goal, Task } from '../domain'
import IBullet, { Priority } from '../domain/ibullet'
import Task from '../domain/task'
import { CatalogStats } from '../domain/catalog'
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

export function itemSorter(t1: IBullet, t2: IBullet): number {
  return t1.sort(t2)
}

function buildNoteMessage(item: IBullet): string {
  return item.description
}

function colorBoards(boards: string[]) {
  return boards.map((x) => grey(x)).join(' ')
}

function isBoardComplete(items: IBullet[]) {
  const { tasks, complete, notes } = _getItemStats(items)
  return tasks === complete && notes === 0
}

function getStar(item: IBullet) {
  return item.isStarred ? yellow('★') : ''
}

function getCommentHint(item: IBullet) {
  return item.comment ? blue('✎') : ''
}

function getLinkHint(item: IBullet) {
  // TODO: that's where it would be so cool to have a clickable link
  // NOTE: link and globe ascii just seem too much
  return item.link ? blue('@') : ''
}

function getRepeatHint(task: Task) {
  return task.repeat ? blue('∞') : ''
  // return task.repeat ? blue('◌') : ''
}

function _getItemStats(items: IBullet[]) {
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

  _buildTitle(key: string, items: IBullet[]) {
    let title = this._configuration.highlightTitle(key)
    if (key === new Date().toDateString()) title += ` ${grey('[Today]')}`

    const { tasks, complete } = _getItemStats(items)
    const correlation = grey(`[${complete}/${tasks}]`)

    return { title, correlation }
  }

  _buildPrefix(item: IBullet) {
    const prefix = []

    const { id } = item

    prefix.push(' '.repeat(4 - String(id).length))
    prefix.push(grey(`${id}.`))

    return prefix.join(' ')
  }

  _buildTaskMessage(item: Task, isArchive = false): string {
    const message = []

    const { isComplete, description } = item

    if (!isComplete && item.priority > 1) {
      const style = this._configuration.priorities[item.priority]
      message.push(style(description))
    } else {
      // message.push(isComplete ? grey(description) : description)
      message.push(isComplete ? grey(description) : description)
    }

    // a task not completed and archived means it was deleted. Make it a
    // "little" more obvious when printing the archive. Of course this may not
    // work for non-task items like notes
    if (!isComplete && item.isTask && isArchive) message.unshift(chalk.bold.red('CANCELLED'))

    // NOTE: alternatively we could leave the actual description as-is, and
    // simply add a prefix to indicate urgency
    // if (!isComplete && item.priority > 1)
    //   message.push(item.priority === 2 ? yellow('(!)') : red('(!!)'))

    return message.join(' ')
  }

  _displayTitle(board: string, items: IBullet[]) {
    const { title: message, correlation: suffix } = this._buildTitle(board, items)
    const titleObj = { prefix: '\n ', message, suffix }

    return log(titleObj)
  }

  async displayItemByBoard(item: IBullet) {
    const age = item.age()
    const star = getStar(item)
    const comment = getCommentHint(item)
    const link = getLinkHint(item)
    let repeat = null
    const suffix = []
    let message = ''

    const prefix = this._buildPrefix(item)

    if (item instanceof Task) {
      message = this._buildTaskMessage(item)
      repeat = getRepeatHint(item)
    } else message = buildNoteMessage(item)

    if (age !== 0) suffix.push(grey(`${age}d`))
    if (star) suffix.push(star)
    if (link) suffix.push(link)
    if (repeat) suffix.push(repeat)
    if (comment.length > 0) suffix.push(comment)

    const { duration, isComplete } = item
    if (duration && duration > 0 && isComplete) {
      suffix.push(grey(msToMinutes(duration)))
    }

    if (item.tags?.length > 0) suffix.push(grey(item.tags.join(' ')))

    const msgObj = { prefix, message, suffix: suffix.join(' ') }

    item.display(msgObj)
  }

  _displayItemByDate(item: IBullet, isArchive = false) {
    const boards = item.boards.filter((x) => x !== this._configuration.defaultBoard)
    const star = getStar(item)

    const prefix = this._buildPrefix(item)
    let message = ''
    if (item instanceof Task) message = this._buildTaskMessage(item, isArchive)
    else message = buildNoteMessage(item)

    const suffix = []

    // FIXME: calendar won't pretty print this one
    if (item instanceof Task) {
      if (item.duration && item.duration > 0 && item.isComplete)
        // FIXME: pretty rendering duration should be a task method
        suffix.push(grey(`${Math.ceil(item.duration / (1000 * 60))}m`))
    }

    suffix.push(colorBoards(boards))
    suffix.push(star)

    const msgObj = { prefix, message, suffix: suffix.join(' ') }

    item.display(msgObj)
  }

  displayByBoard(data: Record<string, IBullet[]>, displayTasks = true) {
    Object.keys(data).forEach((board: string) => {
      if (isBoardComplete(data[board]) && !this._configuration.displayCompleteTasks) return

      this._displayTitle(board, data[board])

      // TODO: allow other sorting strategies
      // data[board].sort(sortByPriorities).forEach((item) => {
      data[board].sort(itemSorter).forEach((item) => {
        if (!displayTasks) return

        if (item instanceof Task && item.isComplete && !this._configuration.displayCompleteTasks)
          return

        this.displayItemByBoard(item)
      })
    })
  }

  displayByDate(data: Record<string, IBullet[]>, isArchive = false) {
    Object.keys(data)
      // we move it to 11pm because otherwise the library considers it to be
      // midnight and subtract to go to UTC+0, effectively moving to the
      // previous day.
      // Initially this was parsed using the local timezone, so there should
      // not be any new conversion, just use the day.
      .map((dt) => parse(`${dt} 23`, 'dd/MM/yyyy HH', new Date()))
      .sort(compareAsc)
      .forEach((date) => {
        const prettyDt = date.toDateString()
        const indexDt = date.toLocaleDateString('en-UK')

        if (isBoardComplete(data[indexDt]) && !this._configuration.displayCompleteTasks) return

        this._displayTitle(prettyDt, data[indexDt])

        data[indexDt].forEach((item) => {
          if (
            item instanceof Task &&
            item.isComplete &&
            !this._configuration.displayCompleteTasks
          ) {
            return
          }

          this._displayItemByDate(item, isArchive)
        })
      })
  }

  displayStats(opts: CatalogStats) {
    if (!this._configuration.displayProgressOverview) return

    const complete = opts.complete || 0
    const inProgress = opts.inProgress || 0
    const pending = opts.pending || 0
    const notes = opts.notes || 0
    const percent = Math.floor(100 * (complete / (inProgress + pending + complete)))
    const estimate = opts.estimate || 0
    const duration = opts.duration || 0

    const prettyPercent =
      percent >= 75 ? green(`${percent}%`) : percent >= 50 ? yellow(`${percent}%`) : `${percent}%`

    let estimateWarning = blue
    if (estimate / (1000 * 60 * 60) > this._configuration.plannedHoursError) estimateWarning = red
    else if (estimate / (1000 * 60 * 60) > this._configuration.plannedHoursWarn)
      estimateWarning = yellow
    const timings = [
      `${green(msToMinutes(duration))} ${grey('worked')}`,
      `${estimateWarning(msToMinutes(estimate))} ${grey('estimated')}`,
    ]

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
    log({ prefix: ' ', message: timings.join(grey(' / ')) })
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

  markComplete(tasks: Task[]) {
    if (tasks.length === 0) return

    const pretty = tasks.map((t: Task) => {
      const duration = msToMinutes(t.duration)
      const estimate = msToMinutes(t.estimate)

      return `${t.id} (${duration}/${estimate})`
    })

    const [prefix, suffix] = ['\n', grey(pretty.join(', '))]
    const message = `Checked ${tasks.length > 1 ? 'tasks' : 'task'}:`
    success({ prefix, message, suffix })
  }

  markIncomplete(tasks: Task[]) {
    if (tasks.length === 0) return

    const ids = tasks.map((t: Task) => t.id)

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

  successCreate(item: IBullet, showDescription = false) {
    const [prefix, suffix] = ['\n', grey(String(item.id))]
    // FIXME: in most cases `typeof Item` is `Object`, but that alternative is
    // a pretty poor UX
    // const message = `Created ${typeof item}`
    let message = `Created ${item.constructor.name}`
    if (showDescription) message += `: ${item.description}`

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

  successPriority(id: string, level: Priority) {
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
