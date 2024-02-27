import fs from 'fs'
import childProcess from 'child_process'
import tmp from 'tmp'

import { prompt } from 'enquirer'
import clipboardy from 'clipboardy'

import { Maybe } from '../types'
import config, { IConfig } from '../config'
import Storage from '../store'
import LocalStorage from '../store/localjson'
import help from '../interfaces/help'
import render from '../interfaces/render'
import { removeDuplicates } from '../shared/utils'
import { parseOptions, isBoardOpt } from '../shared/parser'
import Catalog, { CatalogInnerData } from '../domain/catalog'
import Item from '../domain/item'
import Task, { TaskPriority } from '../domain/task'
// FIXME: i should not need to know about Goal plugin here
import Goal from '../plugins/bb-domain-goal/goal'
import Note from '../domain/note'
import Logger from '../shared/logger'

const log = Logger()

class Taskbook {
  _storage: Storage
  _configuration: IConfig
  _data: Catalog
  _archive: Catalog

  constructor() {
    log.info('initialising taskbook')

    this._configuration = config.get()
    this._storage = new LocalStorage(this._configuration.defaultContext)
    this._archive = this._storage.getArchive()
    this._data = this._storage.get()
  }

  _save(data: Catalog) {
    this._storage.set(data.all())
  }

  _saveArchive(data: Catalog) {
    this._storage.setArchive(data.all())
  }

  _validateIDs(inputIDs: string[], existingIDs = this._data.ids()): string[] {
    if (inputIDs.length === 0) {
      render.missingID()
      process.exit(1)
    }

    inputIDs = removeDuplicates(inputIDs)

    inputIDs.forEach((id) => {
      if (existingIDs.indexOf(id) === -1) {
        render.invalidID(id)
        process.exit(1)
      }
    })

    return inputIDs
  }

  switchContext(name: string) {
    log.info(`switching to context ${name}`)
    config.set('defaultContext', name)

    render.successSwitchContext(name)
  }

  _filterByAttributes(attr: string[], data = this._data) {
    if (data.ids().length === 0) return data
    if (attr.length === 0) return data

    // NOTE: we don't support goals and events because internally they belong
    // to a board and one can display them with the very expressive `tb list
    // goals` and `tb list calendar`. No need for many ways to do the same
    // thing.
    attr.forEach((x) => {
      switch (x) {
        case 'star':
        case 'starred':
          return data.starred()

        case 'done':
        case 'checked':
        case 'complete':
          return data.completed()

        case 'progress':
        case 'started':
        case 'begun':
          return data.inProgress()

        case 'pending':
        case 'unchecked':
        case 'incomplete':
          return data.pending()

        case 'todo':
        case 'task':
        case 'tasks':
          return data.tasks()

        case 'note':
        case 'notes':
          return data.notes()

        // unecessary but makes typescript happy and a little safer
        default:
          return data
      }
    })

    return data
  }

  _groupByBoard(data = this._data, boards = this._data.boards()) {
    const grouped: Record<string, Item[]> = {}

    // NOTE: can `boards` be null?
    if (boards === null || boards.length === 0) boards = this._data.boards()

    data.ids().forEach((id) => {
      boards.forEach((board: string) => {
        if (data.get(id).boards.includes(board) || data.get(id).tags?.includes(board)) {
          // we already have this board with items, append to it
          if (Array.isArray(grouped[board])) return grouped[board].push(data.get(id))

          // initialise that `board` group
          grouped[board] = [data.get(id)]

          return
        }
        return
      })
    })

    // re-order the way `boards` were given
    const orderInit: Record<string, Item[]> = {}
    const ordered = boards.reduce((obj, key) => {
      if (grouped[key]) obj[key] = grouped[key]
      return obj
    }, orderInit)

    return ordered
  }

  _groupByDate(data = this._data, dates = this._data.dates()) {
    const grouped: Record<string, Item[]> = {}

    data.ids().forEach((id) => {
      dates.forEach((date) => {
        const dt = new Date(data.get(id).updatedAt).toDateString()
        if (dt === date) {
          if (Array.isArray(grouped[date])) {
            return grouped[date].push(data.get(id))
          }

          grouped[date] = [data.get(id)]
          return grouped[date]
        }

        return
      })
    })

    return grouped
  }

  _saveItemToArchive(item: Item) {
    const { _data, _archive } = this

    const archiveID = _archive.generateID()
    log.info(`archiving item under id ${archiveID}`)

    _archive.set(archiveID, item)

    this._saveArchive(_archive)

    _data.delete(item.id)
  }

  _saveItemToStorage(item: Item) {
    const { _data, _archive } = this
    const restoreID = _data.generateID()

    item.id = restoreID
    _data.set(restoreID, item)

    this._save(_data)

    _archive.delete(item.id)
  }

  tagItem(desc: string[]) {
    const { description, tags } = parseOptions(desc)
    const ids = description.split(' ')

    const { _data } = this

    ids
      .map((each) => _data.get(each))
      .forEach((item: Item) => {
        item.tags = removeDuplicates(tags.concat(item.tags || []))
      })

    this._save(_data)
    render.successEdit(ids.join(', '))
  }

  createNote(desc: string[]) {
    const { _data } = this
    const storedBoards = _data.boards()
    const storedTags = this._data.tags()

    const { description, tags, boards } = parseOptions(desc, {
      defaultBoard: this._configuration.defaultBoard,
    })
    const id = _data.generateID()
    const note = new Note({ id, description, tags, boards })

    // warn on new tags and boards
    tags.forEach((t) => {
      if (!storedTags.includes(t)) render.warning(note.id, `new tag: ${t}`)
    })
    boards.forEach((b) => {
      if (!storedBoards.includes(b)) render.warning(note.id, `new board: ${b}`)
    })

    _data.set(id, note)
    this._save(_data)

    if (this._configuration.enableCopyID) clipboardy.writeSync(String(id))

    render.successCreate(note)
  }

  copyToClipboard(ids: string[]) {
    ids = this._validateIDs(ids)

    const { _data } = this
    const descriptions: string[] = []

    ids.forEach((id) => descriptions.push(_data.get(id).description))

    clipboardy.writeSync(descriptions.join('\n'))

    render.successCopyToClipboard(ids)
  }

  async checkTasks(ids: string[], duration: Maybe<number>, doneAt: Maybe<Date>) {
    // another gymnastics to allow tags in the list of ids
    const { description, tags } = parseOptions(ids, {
      defaultBoard: this._configuration.defaultBoard,
    })
    ids = this._validateIDs(description.split(' '))

    const { _data } = this
    const checked: Task[] = []
    const unchecked: Task[] = []

    await Promise.all(
      ids.map(async (id) => {
        if (_data.get(id).isTask) {
          const task = _data.task(id)
          if (task === null) throw new Error(`task ${id} is not a task`)

          if (task.isComplete) task.uncheck()
          else task.check(duration, tags)

          // `check` method sets `updatedAt` to now. But if the task is
          // complete and a `doneAt` was provided, overwrite it
          if (task.isComplete && doneAt) task.updatedAt = doneAt.getTime()

          // if duration is > {config number of hours}, ask confirmation
          if (
            task.isComplete &&
            task.duration &&
            // configured as hours so comapre this in ms
            task.duration > this._configuration.suspiciousDuration * 60 * 60 * 1000
          ) {
            // @ts-ignore
            const { isYes } = await prompt({
              type: 'confirm',
              name: 'isYes',
              message: `Duration seems excessive: about ${Math.round(
                task.duration / (60 * 60 * 1000)
              )}h, is that correct`,
            })
            // offer to overwrite if that was a mistake
            if (!isYes) {
              // @ts-ignore
              const { correct } = await prompt({
                type: 'number',
                name: 'correct',
                message: 'How long did it take (in minutes)?',
              })
              task.duration = correct * 60 * 1000
            }
          }

          return task.isComplete ? checked.push(task) : unchecked.push(task)
        }
        // else invalid item id
        return
      })
    )

    this._save(_data)

    for (const t of checked) log.info(`checking task ${t.id}`, t)
    for (const t of unchecked) log.info(`un-checking task ${t.id}`)

    render.markComplete(checked)
    render.markIncomplete(unchecked)
  }

  createTask(desc: string[], cliEstimate?: number, link?: string) {
    const { boards, tags, description, priority, estimate } = parseOptions(desc, {
      defaultBoard: this._configuration.defaultBoard,
    })
    const id = this._data.generateID()
    const task = new Task({
      id,
      description,
      boards,
      tags,
      priority,
      link,
      estimate: estimate || cliEstimate,
    })
    const { _data } = this

    _data.set(id, task)
    this._save(_data)

    if (this._configuration.enableCopyID) clipboardy.writeSync(String(id))

    render.successCreate(task)
  }

  deleteItems(ids: string[]) {
    ids = this._validateIDs(ids)

    const { _data } = this

    ids.forEach((id) => {
      // the operation will also delete `id` from `_data`
      this._saveItemToArchive(_data.get(id))
    })

    this._save(_data)
    render.successDelete(ids)
  }

  displayArchive() {
    log.debug('displaying the whole archive, by dates')
    const groups = this._groupByDate(this._archive, this._archive.dates())

    render.displayByDate(groups)
  }

  displayByBoard() {
    render.displayByBoard(this._groupByBoard())
  }

  displayByDate() {
    render.displayByDate(this._groupByDate())
  }

  displayStats(data = this._data) {
    render.displayStats(data.stats())
  }

  editDescription(input: string[]) {
    const targets = input.filter(isBoardOpt)

    if (targets.length === 0) {
      render.missingID()
      process.exit(1)
    }

    if (targets.length > 1) {
      render.invalidIDsNumber()
      process.exit(1)
    }

    const [target] = targets
    const [id] = this._validateIDs([target.slice(1)])
    const newDesc = input.filter((x) => x !== target).join(' ')

    if (newDesc.length === 0) {
      render.missingDesc()
      process.exit(1)
    }

    const { _data } = this
    _data.get(id).description = newDesc
    this._save(_data)

    render.successEdit(id)
  }

  findItems(terms: string[]) {
    const result = this._data.search(terms)

    render.displayByBoard(this._groupByBoard(result))
  }

  _filterByBoards(boards: string[], data = this._data): Catalog {
    const filtered: CatalogInnerData = {}

    data.ids().forEach((id) => {
      boards.forEach((board: string) => {
        if (data.get(id).boards.includes(board) || data.get(id).tags?.includes(board)) {
          filtered[id] = data.get(id)

          return
        }
        return
      })
    })

    return new Catalog(filtered)
  }

  listByAttributes(terms: string[]): void {
    let boards: string[] = []
    let tags: string[] = []
    let attributes: string[] = []
    const showTasks = terms.length > 0
    const storedBoards = this._data.boards()
    const storedTags = this._data.tags()

    // effectively `showTasks` has been already decided so:
    // - nothing was passed: we show the boards
    // - `all` was passed: we show all boards AND their tasks
    // - attributes were passed: we filter as expected
    if (terms.includes('all')) terms = []

    // parse boards and tags
    terms.forEach((x) => {
      if (storedBoards.indexOf(`@${x}`) >= 0) boards.push(`@${x}`)

      if (storedTags.indexOf(`+${x}`) >= 0) tags.push(`+${x}`)

      // final condition
      return x === 'myboard' ? boards.push(this._configuration.defaultBoard) : attributes.push(x)
    })
    boards = removeDuplicates(boards)
    tags = removeDuplicates(tags)
    attributes = removeDuplicates(attributes)

    let data = this._filterByAttributes(attributes)
    if (boards.length > 0 || tags.length > 0)
      // filter by boards and/or tags
      data = this._filterByBoards(boards.concat(tags), data)

    const groups = this._groupByBoard(data, boards.concat(tags))
    render.displayByBoard(groups, showTasks)

    render.displayStats(data.stats())
  }

  moveBoards(input: string[]) {
    const { _data } = this
    let ids: string[] = []
    let boards: string[] = []

    input.filter(isBoardOpt).forEach((x) => {
      boards.push(x === 'myboard' ? this._configuration.defaultBoard : x)
    })

    if (boards.length === 0) {
      render.missingBoards()
      process.exit(1)
    }

    boards = removeDuplicates(boards)

    input.filter((x) => !isBoardOpt(x)).forEach((x) => ids.push(x))

    if (ids.length === 0) {
      render.missingID()
      process.exit(1)
    }

    ids = this._validateIDs(ids)

    ids.forEach((id) => {
      _data.get(id).boards = boards
    })
    render.successMove(ids.join(', '), boards)

    this._save(_data)
  }

  restoreItems(ids: string[]) {
    ids = this._validateIDs(ids, this._archive.ids())
    const { _archive } = this

    ids.forEach((id) => {
      this._saveItemToStorage(_archive.get(id))
    })

    this._saveArchive(_archive)
    render.successRestore(ids)
  }

  starItems(ids: string[]) {
    ids = this._validateIDs(ids)
    const { _data } = this
    const starred: string[] = []
    const unstarred: string[] = []

    ids.forEach((id) => {
      _data.get(id).isStarred = !_data.get(id).isStarred
      return _data.get(id).isStarred ? starred.push(id) : unstarred.push(id)
    })

    this._save(_data)
    render.markStarred(starred)
    render.markUnstarred(unstarred)
  }

  estimateWork(taskid: string, estimate: number) {
    this._validateIDs([taskid])

    const task = this._data.task(taskid)

    if (task === null) throw new Error(`item ${taskid} is not a task`)

    task.setEstimate(estimate, this._configuration.tshirtSizes)

    this._save(this._data)

    render.successEdit(taskid)
  }

  updatePriority(priority: TaskPriority, taskids: string[]) {
    const { _data } = this

    const ids = this._validateIDs(taskids)

    ids.forEach((taskid: string) => {
      const task = _data.task(taskid)
      if (task === null) throw new Error(`item ${taskid} is not a task`)
      task.priority = priority
      render.successPriority(taskid, priority)
    })

    this._save(_data)
  }

  clear() {
    const ids: string[] = []
    const { _data } = this

    _data.ids().forEach((id) => {
      const item = _data.get(id)

      if (item instanceof Task && item.isComplete) ids.push(id)
      else if (item instanceof Note) ids.push(id)
      // else not something we want to clear
    })

    if (ids.length === 0) return

    this.deleteItems(ids)
  }

  async focus(taskId: string) {
    const { _data } = this
    const task = _data.task(taskId)

    if (task === null) throw new Error(`item ${taskId} is not a task`)

    // TODO: not sure about that focus thing. We need to either scratch the per
    // item rendering, or expose it like `display` per type method
    // implementation. But as it is now, the value is pretty limited and it
    // does make the plugin system a bit harder to implement.
    if (task instanceof Goal) {
      // TODO: `task.board()` to abstract that logic in one place?
      const goalTag = `+${task.description.replace(' ', '')}`
      const subtasks = Object.values(_data.all()).filter((t) => t.tags.includes(goalTag))
      render._displayTitle(task.description, subtasks)
      subtasks.forEach((t) => render.displayItemByBoard(t))
    } else {
      const boards = task.boards.join(' • ')
      render._displayTitle(boards, [task])
      render.displayItemByBoard(task)
    }

    if (task.comment) {
      const decoded = Buffer.from(task.comment, 'base64').toString('ascii')

      const subtasksDone = (decoded.match(/\[x\]/g) || []).length
      const subtasksTodo = (decoded.match(/\[\s\]/g) || []).length

      // console.log(`\n${marked.parse('---')}`)
      // console.log(marked.parse(decoded))
      // console.log(marked.parse('---'))
      console.log(`\n--- ${task.link || ''}`)
      console.log(decoded)
      console.log('---')

      render.displayStats({ complete: subtasksDone, pending: subtasksTodo, notes: 1 })
    } else {
      console.log(`\n--- ${task.link || ''}\n`)
    }
  }

  beginTask(id: string) {
    ;[id] = this._validateIDs([id])

    const { _data } = this
    const started: string[] = []
    const paused: string[] = []

    if (_data.get(id).isTask) {
      const task = _data.task(id)
      // TODO: handle the UI of it
      if (task === null) throw new Error(`item ${id} is not a task`)

      task.begin()

      if (task.inProgress) started.push(id)
      else paused.push(id)
    }
    // TODO: else render error

    this._save(_data)

    if (started.length > 0) render.markStarted(started)
    if (paused.length > 0) render.markPaused(paused)
  }

  comment(itemId: string) {
    // TODO: _validateIDs
    const editor = this._configuration.editor

    const { _data } = this

    const tmpFile = tmp.fileSync({ mode: 0o644, prefix: 'taskbook-', postfix: '.md' })

    let initContent = `# ID ${itemId} - ${_data.get(itemId).description}

> _write content here..._
`
    if (_data.get(itemId).comment)
      // initialise the file with the existing comment
      initContent = Buffer.from(_data.get(itemId).comment as string, 'base64').toString('ascii')
    fs.writeFileSync(tmpFile.fd, initContent)

    childProcess.spawnSync(editor, [`${tmpFile.name}`], { stdio: 'inherit' })
    // TODO: handle child error
    const comment = fs.readFileSync(tmpFile.name, 'utf8').trim()

    const encoded = Buffer.from(comment).toString('base64')

    _data.get(itemId).comment = encoded

    this._save(_data)

    render.successEdit(itemId)
  }

  /**
   * Offer an easy place to loop through all items and apply/backfill logic.
   */
  _migrate() {
    const { _data } = this

    _data.ids().forEach((id) => {
      // if (!_data.get(id)._uid) _data.get(id)._uid = nanoid()
    })

    this._save(_data)
  }

  showManual() {
    // console.log(marked.parse(help))
    console.log(help)
  }
}

export default Taskbook
