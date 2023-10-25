const fs = require('fs')
const childProcess = require('child_process')
const clipboardy = require('clipboardy')
const chalk = require('chalk')
const tmp = require('tmp')
const { marked } = require('marked')
const { markedTerminal } = require('marked-terminal')

const config = require('./config')
const Task = require('./task')
const Goal = require('./goal')
const Note = require('./note')
const EventNote = require('./event')
const Storage = require('./storage')
const help = require('./help')
const render = require('./render')

marked.use(
  markedTerminal({
    firstHeading: chalk.magenta.bold,
  })
)

// TODO: let `@` and `+` be customised?
const _isPriorityOpt = (x) => ['p:1', 'p:2', 'p:3'].indexOf(x) > -1

const _isBoardOpt = (x) => x.startsWith('@')

const _isTagOpt = (x) => x.startsWith('+')

// TODO: utils
const _arrayify = (x) => (Array.isArray(x) ? x : [x])

const _removeDuplicates = (x) => [...new Set(_arrayify(x))]

function _getPriority(desc) {
  const opt = desc.find((x) => _isPriorityOpt(x))
  return opt ? opt[opt.length - 1] : 1
}

function _hasTerms(str, terms) {
  for (const term of terms) {
    if (str.toLocaleLowerCase().indexOf(term.toLocaleLowerCase()) > -1) {
      return str
    }
  }

  return null
}

/**
 * Filter the list of current tasks available to the command.
 */
function _filter(data, exclude) {
  Object.keys(data).forEach((id) => {
    if (exclude(data[id])) delete data[id]
  })

  return data
}

const _filterNote = (data) => _filter(data, (item) => item._isTask)
const _filterPending = (data) => _filter(data, (item) => !item._isTask || item.isComplete)
const _filterComplete = (data) => _filter(data, (item) => !item._isTask || !item.isComplete)
const _filterInProgress = (data) => _filter(data, (item) => !item._isTask || !item.inProgress)
const _filterStarred = (data) => _filter(data, (item) => !item.isStarred)
const _filterTask = (data) => _filter(data, (item) => !item._isTask)

class Taskbook {
  constructor() {
    this._storage = new Storage()
  }

  get _configuration() {
    return config.get()
  }

  get _archive() {
    return this._storage.getArchive()
  }

  get _data() {
    return this._storage.get()
  }

  _save(data) {
    this._storage.set(data)
  }

  _saveArchive(data) {
    this._storage.setArchive(data)
  }

  _generateID(data = this._data) {
    const ids = Object.keys(data).map((id) => parseInt(id, 10))
    const max = ids.length === 0 ? 0 : Math.max(...ids)
    return max + 1
  }

  _validateIDs(inputIDs, existingIDs = this._getIDs()) {
    if (inputIDs.length === 0) {
      render.missingID()
      process.exit(1)
    }

    inputIDs = _removeDuplicates(inputIDs)

    inputIDs.forEach((id) => {
      if (existingIDs.indexOf(Number(id)) === -1) {
        render.invalidID(id)
        process.exit(1)
      }
    })

    return inputIDs
  }

  _getBoards() {
    const { _data } = this
    const boards = ['My Board']

    Object.keys(_data).forEach((id) => {
      boards.push(..._data[id].boards.filter((x) => boards.indexOf(x) === -1))
    })

    return boards
  }

  _getTags() {
    const { _data } = this
    const tags = []

    Object.keys(_data).forEach((id) => {
      // TODO: once migration is completed, make tags field mandatory
      if (_data[id].tags) tags.push(..._data[id].tags.filter((x) => tags.indexOf(x) === -1))
    })

    return tags
  }

  /**
   * Compile list of task dates,
   * which are the timestamp the task was completed
   * (or the note and event was created?)
   */
  _getDates(data = this._data) {
    const dates = []

    Object.keys(data).forEach((id) => {
      // for migration purpose, as `_updatedAt should always be set`
      let dt = new Date().toDateString()
      if (data[id]._updatedAt) dt = new Date(data[id]._updatedAt).toDateString()

      // avoid duplicates
      if (dates.indexOf(dt) === -1) {
        dates.push(dt)
      }
    })

    return dates
  }

  _getIDs(data = this._data) {
    return Object.keys(data).map((id) => parseInt(id, 10))
  }

  /**
   * Main parsing entry point - extract the actual description
   * nd the specific objets like boards and priorities.
   */
  _getOptions(input) {
    const [boards, tags, desc] = [[], [], []]

    if (input.length === 0) {
      render.missingDesc()
      process.exit(1)
    }

    const id = this._generateID()
    const priority = _getPriority(input)

    input.forEach((x) => {
      // priorities: already processed
      if (_isPriorityOpt(x)) {
        // priorities were already processed
      } else if (_isBoardOpt(x)) {
        return boards.push(x)
      } else if (_isTagOpt(x)) {
        return tags.push(x)
      } else if (x.length > 1) {
        return desc.push(x)
      }

      // make linter happy
      return null
    })

    const description = desc.join(' ')

    if (boards.length === 0) {
      // TODO: use config.DEFAULT_BOARD
      boards.push('My Board')
    }

    return { boards, tags, description, id, priority }
  }

  _getStats() {
    const { _data } = this
    let [complete, inProgress, pending, notes] = [0, 0, 0, 0]

    Object.keys(_data).forEach((id) => {
      if (_data[id]._isTask) {
        return _data[id].isComplete ? complete++ : _data[id].inProgress ? inProgress++ : pending++
      }

      return notes++
    })

    const total = complete + pending + inProgress
    const percent = total === 0 ? 0 : Math.floor((complete * 100) / total)

    return { percent, complete, inProgress, pending, notes }
  }

  _filterByAttributes(attr, data = this._data) {
    if (Object.keys(data).length === 0) {
      return data
    }

    attr.forEach((x) => {
      switch (x) {
        case 'star':
        case 'starred':
          data = _filterStarred(data)
          break

        case 'done':
        case 'checked':
        case 'complete':
          data = _filterComplete(data)
          break

        case 'progress':
        case 'started':
        case 'begun':
          data = _filterInProgress(data)
          break

        case 'pending':
        case 'unchecked':
        case 'incomplete':
          data = _filterPending(data)
          break

        case 'todo':
        case 'task':
        case 'tasks':
          data = _filterTask(data)
          break

        case 'note':
        case 'notes':
          data = _filterNote(data)
          break

        default:
          break
      }
    })

    return data
  }

  _groupByBoard(data = this._data, boards = this._getBoards()) {
    const grouped = {}

    if (boards.length === 0) {
      boards = this._getBoards()
    }

    // FIXME: list them in order it was given
    Object.keys(data).forEach((id) => {
      boards.forEach((board) => {
        if (data[id].boards.includes(board) || data[id].tags?.includes(board)) {
          if (Array.isArray(grouped[board])) {
            return grouped[board].push(data[id])
          }

          grouped[board] = [data[id]]
          return grouped[board]
        }
      })
    })

    // re-order the way `boards` were given
    const ordered = boards.reduce((obj, key) => {
      if (grouped[key]) obj[key] = grouped[key]
      return obj
    }, {})

    return ordered
  }

  _groupByDate(data = this._data, dates = this._getDates()) {
    const grouped = {}

    Object.keys(data).forEach((id) => {
      dates.forEach((date) => {
        const dt = new Date(data[id]._updatedAt).toDateString()
        if (dt === date) {
          if (Array.isArray(grouped[date])) {
            return grouped[date].push(data[id])
          }

          grouped[date] = [data[id]]
          return grouped[date]
        }
      })
    })

    return grouped
  }

  _saveItemToArchive(item) {
    const { _archive } = this
    const archiveID = this._generateID(_archive)

    item._id = archiveID
    _archive[archiveID] = item

    this._saveArchive(_archive)
  }

  _saveItemToStorage(item) {
    const { _data } = this
    const restoreID = this._generateID()

    item._id = restoreID
    _data[restoreID] = item

    this._save(_data)
  }

  tagItem(itemid, tags) {
    tags = tags.map((each) => {
      if (!each.startsWith('+')) return `+${each}`
      return each
    })

    const { _data } = this

    // TODO: remove potential duplicates
    tags = tags.concat(_data[itemid].tags || [])

    _data[itemid].tags = tags
    this._save(_data)
    render.successEdit(itemid)
  }

  createNote(desc) {
    const { _data } = this
    const storedBoards = this._getBoards()
    const storedTags = this._getTags()

    const { id, description, tags, boards } = this._getOptions(desc)
    const note = new Note({ id, description, tags, boards })

    // warn on new tags and boards
    tags.forEach((t) => {
      if (!storedTags.includes(t)) render.warning(note, `new tag: ${t}`)
    })
    boards.forEach((b) => {
      if (!storedBoards.includes(b)) render.warning(note, `new board: ${b}`)
    })

    _data[id] = note
    this._save(_data)

    if (this._configuration.enableCopyID) clipboardy.writeSync(String(id))

    render.successCreate(note)
  }

  createEvent(schedule, desc, duration) {
    const boards = ['@calendar']
    const { id, description, tags } = this._getOptions(desc)
    const event = new EventNote({ id, description, boards, tags, schedule, duration })
    const { _data } = this

    _data[id] = event
    this._save(_data)

    if (this._configuration.enableCopyID) clipboardy.writeSync(String(id))

    render.successCreate(event)
  }

  copyToClipboard(ids) {
    ids = this._validateIDs(ids)
    const { _data } = this
    const descriptions = []

    ids.forEach((id) => descriptions.push(_data[id].description))

    clipboardy.writeSync(descriptions.join('\n'))
    render.successCopyToClipboard(ids)
  }

  checkTasks(ids, duration) {
    ids = this._validateIDs(ids)
    const { _data } = this
    const [checked, unchecked] = [[], []]
    const now = new Date()

    ids.forEach((id) => {
      if (_data[id]._isTask) {
        _data[id].inProgress = false
        _data[id].isComplete = !_data[id].isComplete

        if (_data[id].isComplete) {
          // if duration is given, converts minutes to ms
          if (duration) _data[id]._duration = duration * 60 * 1000
          // update time spent - of course if `tb begin` was not used we could do
          // now - _createdAt. But it's almost certain to be innacurate, so I would
          // rather assume one has to first begin a task to enable time tracking
          else if (_data[id]._startedAt) _data[id]._duration += now - _data[id]._startedAt

          _data[id]._updatedAt = now.getTime()
          _data[id]._startedAt = null
        } else {
          // been unchecked, not done
          _data[id]._updatedAt = null
        }

        return _data[id].isComplete ? checked.push(id) : unchecked.push(id)
      }
      // else invalid item id
    })

    this._save(_data)

    render.markComplete(checked)
    render.markIncomplete(unchecked)
  }

  createTask(desc) {
    const { boards, tags, description, id, priority } = this._getOptions(desc)
    const task = new Task({ id, description, boards, tags, priority })
    const { _data } = this

    _data[id] = task
    this._save(_data)

    if (this._configuration.enableCopyID) clipboardy.writeSync(String(id))

    render.successCreate(task)
  }

  createGoal(desc) {
    const { id, description, priority, tags } = this._getOptions(desc)
    // we don't parse goals but instead assign it right away to the predefined `goals` one.
    const boards = ['@goals']

    const goal = new Goal({ id, description, boards, priority, tags })
    const { _data } = this

    _data[id] = goal
    this._save(_data)

    if (this._configuration.enableCopyID) clipboardy.writeSync(String(id))

    render.successCreate(goal)
  }

  linkToGoal(goalID, taskIDs) {
    const { _data } = this
    // camel-case it
    const goalTag = `+${_data[goalID].description.replace(' ', '')}`
    // alternative: const goalBoard = `@goal-${goalID}`

    taskIDs.forEach((taskID) => {
      // TODO: check if not there already
      _data[taskID].tags.push(goalTag)
      _data[taskID].isStarred = true
    })

    // we use a start to indicate this is linked to a goal
    // FIXME: this.starItems(taskIDs) won't save it
    render.markStarred(taskIDs)

    this._save(_data)

    // TODO: use a more sepcific rendering
    render.successMove(taskIDs.join(', '), [goalTag])
  }

  deleteItems(ids) {
    ids = this._validateIDs(ids)
    const { _data } = this

    ids.forEach((id) => {
      this._saveItemToArchive(_data[id])
      delete _data[id]
    })

    this._save(_data)
    render.successDelete(ids)
  }

  displayArchive() {
    render.displayByDate(this._groupByDate(this._archive, this._getDates(this._archive)))
  }

  displayByBoard() {
    render.displayByBoard(this._groupByBoard())
  }

  displayByDate() {
    render.displayByDate(this._groupByDate())
  }

  displayStats() {
    render.displayStats(this._getStats())
  }

  editDescription(input) {
    const targets = input.filter(_isBoardOpt)

    if (targets.length === 0) {
      render.missingID()
      process.exit(1)
    }

    if (targets.length > 1) {
      render.invalidIDsNumber()
      process.exit(1)
    }

    const [target] = targets
    const id = this._validateIDs(target.replace('@', ''))
    const newDesc = input.filter((x) => x !== target).join(' ')

    if (newDesc.length === 0) {
      render.missingDesc()
      process.exit(1)
    }

    const { _data } = this
    _data[id].description = newDesc
    this._save(_data)
    render.successEdit(id)
  }

  findItems(terms) {
    const result = {}
    const { _data } = this

    Object.keys(_data).forEach((id) => {
      if (!_hasTerms(_data[id].description, terms)) {
        return
      }

      result[id] = _data[id]
    })

    render.displayByBoard(this._groupByBoard(result))
  }

  listByAttributes(terms) {
    let [boards, tags, attributes] = [[], [], []]
    const showTasks = terms.length > 0
    const storedBoards = this._getBoards()
    const storedTags = this._getTags()

    // effectively `showTasks` has been already decided so:
    // - nothing was passed: we show the boards
    // - `all` was passed: we show all boards AND their tasks
    // - attributes were passed: we filter as expected
    if (terms.includes('all')) terms = []

    // parse boards and tags
    terms.forEach((x) => {
      if (storedBoards.indexOf(`@${x}`) >= 0) {
        return boards.push(`@${x}`)
      }
      if (storedTags.indexOf(`+${x}`) >= 0) {
        return tags.push(`+${x}`)
      }

      return x === 'myboard' ? boards.push('My Board') : attributes.push(x)
    })
      ;[boards, tags, attributes] = [boards, tags, attributes].map((x) => _removeDuplicates(x))

    const data = this._filterByAttributes(attributes)

    render.displayByBoard(this._groupByBoard(data, boards.concat(tags)), showTasks)
  }

  moveBoards(input) {
    const { _data } = this
    let [ids, boards] = [[], []]

    input.filter(_isBoardOpt).forEach((x) => {
      boards.push(x === 'myboard' ? 'My Board' : x)
    })

    if (boards.length === 0) {
      render.missingBoards()
      process.exit(1)
    }

    boards = _removeDuplicates(boards)

    input
      .filter((x) => !_isBoardOpt(x))
      .forEach((x) => {
        ids.push(x)
      })

    if (ids.length === 0) {
      render.missingID()
      process.exit(1)
    }

    ids = this._validateIDs(ids)

    ids.forEach((id) => {
      _data[id].boards = boards
      render.successMove(id, boards)
    })

    this._save(_data)
  }

  restoreItems(ids) {
    ids = this._validateIDs(ids, this._getIDs(this._archive))
    const { _archive } = this

    ids.forEach((id) => {
      this._saveItemToStorage(_archive[id])
      delete _archive[id]
    })

    this._saveArchive(_archive)
    render.successRestore(ids)
  }

  starItems(ids) {
    ids = this._validateIDs(ids)
    const { _data } = this
    const [starred, unstarred] = [[], []]

    ids.forEach((id) => {
      _data[id].isStarred = !_data[id].isStarred
      return _data[id].isStarred ? starred.push(id) : unstarred.push(id)
    })

    this._save(_data)
    render.markStarred(starred)
    render.markUnstarred(unstarred)
  }

  updatePriority(input) {
    const level = input.find((x) => ['1', '2', '3'].indexOf(x) > -1)

    if (!level) {
      render.invalidPriority()
      process.exit(1)
    }

    const targets = input.filter(_isBoardOpt)

    if (targets.length === 0) {
      render.missingID()
      process.exit(1)
    }

    if (targets.length > 1) {
      render.invalidIDsNumber()
      process.exit(1)
    }

    const [target] = targets
    const id = this._validateIDs(target.replace('@', ''))

    const { _data } = this
    _data[id].priority = level
    this._save(_data)
    render.successPriority(id, level)
  }

  clear() {
    const ids = []
    const { _data } = this

    Object.keys(_data).forEach((id) => {
      if (_data[id].isComplete) {
        ids.push(id)
      }
    })

    if (ids.length === 0) return

    this.deleteItems(ids)
  }

  async focus(taskId) {
    const { _data } = this
    const task = _data[taskId]

    // TODO: test
    if (task._type === 'goal') {
      const goalBoard = `@${task.description.replace(' ', '')}`
      const subtasks = Object.values(_data).filter((t) => t.boards.includes(goalBoard))
      render._displayTitle(task.description, subtasks)
      subtasks.forEach((t) => render._displayItemByBoard(t))
    } else {
      const boards = task.boards.join(' • ')
      render._displayTitle(boards, [task])
      render._displayItemByBoard(task)
    }

    if (task.comment) {
      const decoded = Buffer.from(task.comment, 'base64').toString('ascii')

      const subtasksDone = (decoded.match(/\[x\]/g) || []).length
      const subtasksTodo = (decoded.match(/\[\s\]/g) || []).length

      console.log(`\n${marked.parse('---')}`)
      console.log(marked.parse(decoded))
      console.log(marked.parse('---'))

      // this.displayStats({ percent, complete, inProgress, pending: , notes: 1 })
      render.displayStats({ complete: subtasksDone, pending: subtasksTodo, notes: 1 })
    }
  }

  beginTask(id) {
    ;[id] = this._validateIDs([id])
    const { _data } = this
    const [started, paused] = [[], []]

    if (_data[id]._isTask) {
      _data[id].isComplete = false
      _data[id].inProgress = !_data[id].inProgress

      const now = new Date()
      if (_data[id].inProgress) {
        started.push(id)
        // record start time, no change on duration
        _data[id]._startedAt = now.getTime()
      } else {
        paused.push(id)
        // update duration
        _data[id]._duration += now.getTime() - _data[id]._startedAt
        _data[id]._startedAt = null
      }
    }
    // TODO: else render error

    this._save(_data)

    if (started.length > 0) render.markStarted(started)
    if (paused.length > 0) render.markPaused(paused)
  }

  comment(itemId) {
    // TODO: _validateIDs
    // TODO: there should be a config
    const editor = process.env.EDITOR || 'vi'

    const { _data } = this

    // TODO: if comment exists already, initialise editor with that
    const tmpFile = tmp.fileSync({ mode: 0o644, prefix: 'taskbook-', postfix: '.md' })

    let initContent = `# ID ${itemId} - ${_data[itemId].description}

> write content here...
`
    if (_data[itemId].comment)
      // initialise the file with the existing comment
      initContent = Buffer.from(_data[itemId].comment, 'base64').toString('ascii')
    fs.writeFileSync(tmpFile.fd, initContent)

    const child = childProcess.spawnSync(editor, [`${tmpFile.name}`], { stdio: 'inherit' })
    // TODO: handle child error
    const comment = fs.readFileSync(tmpFile.name, 'utf8').trim()

    const encoded = Buffer.from(comment).toString('base64')

    _data[itemId].comment = encoded

    this._save(_data)

    render.successEdit(itemId)
  }

  showManual() {
    console.log(marked.parse(help))
  }
}

module.exports = new Taskbook()
