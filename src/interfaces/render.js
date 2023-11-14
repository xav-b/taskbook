const chalk = require('chalk')
const signale = require('signale')

const config = require('../config').default

signale.config({ displayLabel: false })

// have no idea why `signal.config` doesn't work so we create a new custom logger
const { event, goal } = new signale.Signale({
  displayLabel: false,
  types: {
    event: {
      badge: '⏲',
      color: 'blue',
      label: '',
    },
    goal: {
      badge: '🎯',
      color: 'yellow',
      label: '',
    },
  },
})

const { await: wait, error, log, note, pending, success, warn } = signale
const { blue, green, magenta, red, underline, yellow } = chalk
const grey = chalk.cyan.dim

/**
 * Road to configurable theme
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

// TODO: move that to utils or something
function sortByPriorities(t1, t2) {
  // `1` is the dafault and lowest priority
  const priority1 = parseInt(t1.priority || '1', 10)
  const priority2 = parseInt(t2.priority || '1', 10)

  // we want to have top priorities first, down to lowest
  // so here the highest priority should come as "lower"
  // than the lowest ones
  return priority2 - priority1
}

class Render {
  get _configuration() {
    return config.get()
  }

  _colorBoards(boards) {
    return boards.map((x) => grey(x)).join(' ')
  }

  _isBoardComplete(items) {
    const { tasks, complete, notes } = this._getItemStats(items)
    return tasks === complete && notes === 0
  }

  _getAge(birthday) {
    const daytime = 24 * 60 * 60 * 1000
    const age = Math.round(Math.abs((birthday - Date.now()) / daytime))
    return age === 0 ? '' : grey(`${age}d`)
  }

  _getCorrelation(items) {
    const { tasks, complete } = this._getItemStats(items)
    return grey(`[${complete}/${tasks}]`)
  }

  _getItemStats(items) {
    let [tasks, complete, notes] = [0, 0, 0]

    items.forEach((item) => {
      if (item._isTask) {
        tasks++
        if (item.isComplete) {
          return complete++
        }
      }

      return notes++
    })

    return { tasks, complete, notes }
  }

  _getStar(item) {
    return item.isStarred ? yellow('★') : ''
  }

  _getCommentHint(item) {
    return item.comment ? blue('✎') : ''
  }

  _buildTitle(key, items) {
    let title = this._configuration.highlightTitle(key)
    if (key === new Date().toDateString()) title += ` ${grey('[Today]')}`

    const correlation = this._getCorrelation(items)

    return { title, correlation }
  }

  _buildPrefix(item) {
    const prefix = []

    const { _id } = item

    prefix.push(' '.repeat(4 - String(_id).length))
    prefix.push(grey(`${_id}.`))

    return prefix.join(' ')
  }

  _buildMessage(item) {
    const message = []

    const { isComplete, description } = item
    const priority = parseInt(item.priority, 10)

    if (!isComplete && priority > 1) {
      const color = this._configuration.priorities[priority]
      message.push(underline[color](description))
    } else {
      message.push(isComplete ? grey(description) : description)
    }

    if (!isComplete && priority > 1) {
      message.push(priority === 2 ? yellow('(!)') : red('(!!)'))
    }

    return message.join(' ')
  }

  _displayTitle(board, items) {
    const { title: message, correlation: suffix } = this._buildTitle(board, items)
    const titleObj = { prefix: '\n ', message, suffix }

    return log(titleObj)
  }

  _displayItemByBoard(item) {
    const { _type, isComplete, inProgress, tags, _duration } = item
    const age = this._getAge(item._createdAt)
    const star = this._getStar(item)
    const comment = this._getCommentHint(item)

    const prefix = this._buildPrefix(item)
    const message = this._buildMessage(item)
    const suffix = []
    if (age.length === 0) suffix.push(age)
    if (star) suffix.push(star)
    if (comment) suffix.push(comment)
    if (_duration > 0 && isComplete) {
      // convert to minutes
      let prettyDuration = ''
      const minutes = _duration / (1000 * 60)
      if (minutes > 60) prettyDuration = `${Math.ceil(minutes / 60)}h`
      else prettyDuration = `${Math.ceil(minutes / 60)}m`
      suffix.push(grey(prettyDuration))
    }
    if (tags?.length > 0) suffix.push(grey(tags.join(' ')))

    const msgObj = { prefix, message, suffix: suffix.join(' ') }

    if (_type === 'task')
      return isComplete ? success(msgObj) : inProgress ? wait(msgObj) : pending(msgObj)

    if (_type === 'note') return note(msgObj)

    if (_type === 'goal') {
      msgObj.message = `${blue('goal')}: ${message}`
      return isComplete ? success(msgObj) : inProgress ? wait(msgObj) : goal(msgObj)
    }

    if (_type === 'event') {
      msgObj.message = `${blue(item.schedule)} ${message}`
      if (item.duration) msgObj.suffix = grey(item.duration)

      return isComplete ? success(msgObj) : inProgress ? wait(msgObj) : event(msgObj)
    }

    throw new Error(`item of type ${_type} is not supported`)
  }

  _displayItemByDate(item) {
    const { _type, isComplete, inProgress, _duration } = item
    const boards = item.boards.filter((x) => x !== 'My Board')
    const star = this._getStar(item)

    const prefix = this._buildPrefix(item)
    const message = this._buildMessage(item)

    const suffix = []
    if (_duration > 0 && isComplete) suffix.push(grey(`${Math.ceil(_duration / (1000 * 60))}m`))
    suffix.push(this._colorBoards(boards))
    suffix.push(star)

    const msgObj = { prefix, message, suffix: suffix.join(' ') }

    if (_type === 'task')
      return isComplete ? success(msgObj) : inProgress ? wait(msgObj) : pending(msgObj)

    if (_type === 'note') return note(msgObj)

    if (_type === 'event') {
      msgObj.message = `${chalk.blue(item.schedule)} ${message}`
      if (item.duration) msgObj.suffix = grey(item.duration)

      return isComplete ? success(msgObj) : inProgress ? wait(msgObj) : event(msgObj)
    }

    throw new Error(`item of type ${_type} is not supported`)
  }

  displayByBoard(data, displayTasks = true) {
    Object.keys(data).forEach((board) => {
      if (this._isBoardComplete(data[board]) && !this._configuration.displayCompleteTasks) {
        return
      }

      this._displayTitle(board, data[board])

      // TODO: allow other sorting strategies (default by id)
      data[board].sort(sortByPriorities).forEach((item) => {
        if (!displayTasks) return
        if (item._isTask && item.isComplete && !this._configuration.displayCompleteTasks) {
          return
        }

        this._displayItemByBoard(item)
      })
    })
  }

  displayByDate(data) {
    Object.keys(data).forEach((date) => {
      if (this._isBoardComplete(data[date]) && !this._configuration.displayCompleteTasks) {
        return
      }

      this._displayTitle(date, data[date])

      data[date].forEach((item) => {
        if (item._isTask && item.isComplete && !this._configuration.displayCompleteTasks) {
          return
        }

        this._displayItemByDate(item)
      })
    })
  }

  displayStats({ percent, complete, inProgress, pending, notes }) {
    if (!this._configuration.displayProgressOverview) {
      return
    }

    complete = complete || 0
    inProgress = inProgress || 0
    pending = pending || 0
    notes = notes || 0
    percent = percent || Math.ceil(100 * (complete / (inProgress + pending + complete)))

    percent =
      percent >= 75 ? green(`${percent}%`) : percent >= 50 ? yellow(`${percent}%`) : `${percent}%`

    const status = [
      `${green(complete)} ${grey('done')}`,
      `${blue(inProgress)} ${grey('in-progress')}`,
      `${magenta(pending)} ${grey('pending')}`,
      `${blue(notes)} ${grey(notes === 1 ? 'note' : 'notes')}`,
    ]

    if (complete !== 0 && inProgress === 0 && pending === 0 && notes === 0) {
      log({ prefix: '\n ', message: 'All done!', suffix: yellow('★') })
    }

    if (pending + inProgress + complete + notes === 0) {
      log({ prefix: '\n ', message: 'Type `tb --help` to get started!', suffix: yellow('★') })
    }

    log({ prefix: '\n ', message: grey(`${percent} of all tasks complete.`) })
    log({ prefix: ' ', message: status.join(grey(' · ')), suffix: '\n' })
  }

  invalidCustomAppDir(path) {
    const [prefix, suffix] = ['\n', red(path)]
    const message = 'Custom app directory was not found on your system:'
    error({ prefix, message, suffix })
  }

  invalidID(id) {
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

  markComplete(ids) {
    if (ids.length === 0) {
      return
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Checked ${ids.length > 1 ? 'tasks' : 'task'}:`
    success({ prefix, message, suffix })
  }

  markIncomplete(ids) {
    if (ids.length === 0) {
      return
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Unchecked ${ids.length > 1 ? 'tasks' : 'task'}:`
    success({ prefix, message, suffix })
  }

  markStarted(ids) {
    if (ids.length === 0) {
      return
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Started ${ids.length > 1 ? 'tasks' : 'task'}:`
    success({ prefix, message, suffix })
  }

  markPaused(ids) {
    if (ids.length === 0) {
      return
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Paused ${ids.length > 1 ? 'tasks' : 'task'}:`
    success({ prefix, message, suffix })
  }

  markStarred(ids) {
    if (ids.length === 0) {
      return
    }

    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Starred ${ids.length > 1 ? 'items' : 'item'}:`
    success({ prefix, message, suffix })
  }

  markUnstarred(ids) {
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

  warning({ _id }, message) {
    if (!this._configuration.displayWarnings) return

    const suffix = grey(_id)
    warn({ message: yellow(message), suffix })
  }

  successCreate({ _id, _type }) {
    const [prefix, suffix] = ['\n', grey(_id)]
    const message = `Created ${_type}`
    success({ prefix, message, suffix })
  }

  successEdit(id) {
    const [prefix, suffix] = ['\n', grey(id)]
    const message = 'Edited item:'
    success({ prefix, message, suffix })
  }

  successDelete(ids) {
    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Deleted ${ids.length > 1 ? 'items' : 'item'}:`
    success({ prefix, message, suffix })
  }

  successMove(id, boards) {
    const [prefix, suffix] = ['\n', grey(boards.join(', '))]
    const message = `Move item: ${grey(id)} to`
    success({ prefix, message, suffix })
  }

  successPriority(id, level) {
    const prefix = '\n'
    const message = `Updated priority of task: ${grey(id)} to`
    const suffix = level === '3' ? red('high') : level === '2' ? yellow('medium') : green('normal')
    success({ prefix, message, suffix })
  }

  successRestore(ids) {
    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Restored ${ids.length > 1 ? 'items' : 'item'}:`
    success({ prefix, message, suffix })
  }

  successCopyToClipboard(ids) {
    const [prefix, suffix] = ['\n', grey(ids.join(', '))]
    const message = `Copied the ${ids.length > 1 ? 'descriptions of items' : 'description of item'
      }:`
    success({ prefix, message, suffix })
  }
}

module.exports = new Render()
