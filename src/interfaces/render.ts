import chalk from 'chalk'
import { parse, compareAsc } from 'date-fns'

import { msToMinutes } from '../shared/utils'
import IBullet, { Priority } from '../domain/ibullet'
import Task from '../domain/task'
import { CatalogStats } from '../domain/catalog'
import { error, log, success, warn } from './printer'
import config from '../config'

const { blue, green, magenta, red, yellow } = chalk
const { grey } = config.theme

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

function getItemStats(items: IBullet[]) {
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
  const { tasks, complete, notes } = getItemStats(items)
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
}

/**
 * Build the 4-chars columns that shows the item ID.
 */
function buildPrefix(itemId: number) {
  return [
    // ID column 4 chars (meaning we should not have 5-figures IDs)
    // (should this be a constant configuration?)
    ' '.repeat(4 - String(itemId).length),
    grey(`${itemId}.`),
    // if we wanted to build subtasks we would only need that
    // if (isSubtask) prefix.push('\t'),
  ].join(' ')
}

function buildTaskMessage(item: Task, isArchive = false): string {
  const message = []

  const { isComplete, description } = item

  // look to prefix a scope to the task, if any of its tags are in the
  // configured "highlightTags"
  const toHighlight = item.tags.filter((tag) => (config.local.highlightTags ?? []).includes(tag))
  if (toHighlight.length > 0) {
    // pick the first one - not great but I don't see a valid case where it
    // makes sense to display nicely several matches
    message.push(`${chalk.bold(toHighlight[0].replace('+', ''))}:`)
    // no need to display that tag then
    // FIXME: that's a bit dangerous to mutate the item though...
    item.tags = item.tags.filter((tag) => tag !== toHighlight[0])
  }

  if (!isComplete && item.priority > 1) {
    const style = config.theme.priorities[item.priority]
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

class Render {
  _buildTitle(key: string, items: IBullet[]) {
    let title = config.theme.highlightTitle(key)
    if (key === new Date().toDateString()) title += ` ${grey('[Today]')}`

    const { tasks, complete } = getItemStats(items)
    const correlation = grey(`[${complete}/${tasks}]`)

    return { title, correlation }
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

    const prefix = buildPrefix(item.id)

    if (item instanceof Task) {
      message = buildTaskMessage(item)
      repeat = getRepeatHint(item)
    } else message = buildNoteMessage(item)

    if (age !== 0 && config.local.showAge) suffix.push(grey(`${age}d`))
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
    const boards = item.boards.filter((x) => x !== config.local.defaultBoard)
    const star = getStar(item)

    const prefix = buildPrefix(item.id)
    let message = ''
    if (item instanceof Task) message = buildTaskMessage(item, isArchive)
    else message = buildNoteMessage(item)

    const suffix = []

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
      if (isBoardComplete(data[board]) && !config.local.displayCompleteTasks) return

      this._displayTitle(board, data[board])

      data[board].sort(itemSorter).forEach((item) => {
        if (!displayTasks) return

        if (item instanceof Task && item.isComplete && !config.local.displayCompleteTasks) return

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

        if (isBoardComplete(data[indexDt]) && !config.local.displayCompleteTasks) return

        this._displayTitle(prettyDt, data[indexDt])

        data[indexDt].forEach((item) => {
          if (item instanceof Task && item.isComplete && !config.local.displayCompleteTasks) {
            return
          }

          this._displayItemByDate(item, isArchive)
        })
      })
  }

  displayStats(opts: CatalogStats) {
    if (!config.local.displayProgressOverview) return

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
    if (estimate / (1000 * 60 * 60) > config.local.plannedHoursError) estimateWarning = red
    else if (estimate / (1000 * 60 * 60) > config.local.plannedHoursWarn) estimateWarning = yellow
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
    if (ids.length === 0) return

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
    if (ids.length === 0) return

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Starred ${ids.length > 1 ? 'items' : 'item'}:`
    success({ prefix, message, suffix })
  }

  markUnstarred(ids: string[]) {
    if (ids.length === 0) return

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
    if (!config.local.displayWarnings) return

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
