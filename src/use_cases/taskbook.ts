import { Signale } from 'signale'
import { prompt } from 'enquirer'
import clipboardy from 'clipboardy'

import { Maybe } from '../types'
import Storage from '../store'
import cacheStorage from '../store/localcache'
import LocalStorage from '../store/localjson'
import { help, goodDay } from '../interfaces/text'
import render from '../interfaces/render'
import { removeDuplicates } from '../shared/utils'
import { parseOptions, isBoardOpt } from '../shared/parser'
import Catalog, {
  filterByBoards,
  groupByLastUpdateDay,
  filterByAttributes,
} from '../domain/catalog'
import IBullet, { Priority } from '../domain/ibullet'
import Task from '../domain/task'
import Note from '../domain/note'
import Logger from '../shared/logger'
import events from './events'
import config from '../config'

const debug = require('debug')('tb:core:taskbook')

const log = Logger()
const cache = cacheStorage.init()

class Taskbook {
  isNewDay: boolean

  _storage: Storage

  _data: Catalog

  constructor() {
    debug('initialising taskbook')

    debug('loading configuration')
    debug(`loading archive and items (ctx ${config.state.currentContext})`)
    this._storage = new LocalStorage(config.state.currentContext)

    this._data = this._storage.get()

    // determine if this is the first run of the day
    this.isNewDay = false
    const last = cache.get('root.lastOpen')
    debug(`last taskbook run: ${last}`)

    if (last !== null) {
      this.isNewDay = new Date(last).getDate() !== new Date().getDate()
    }

    // keep track of the last time we ran taskbook
    cache.set('root.lastOpen', new Date().toLocaleString())
  }

  hello() {
    if (this.isNewDay && config.local.greetings) {
      goodDay()
    }

    debug('checking recurrent tasks')
    // the operation is idempotent
    this.scheduleRecurrentTasks()
  }

  _save(data: Catalog = this._data) {
    this._storage.set(data.all())
  }

  _saveArchive(data: Catalog) {
    this._storage.set(data.all(), 'archive')
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

  /**
   * Look through recurrent tasks, and if:
   *  - their schedule makes them needed today
   *  - and they don't exist yet
   * Then create a new task
   */
  scheduleRecurrentTasks() {
    debug('scheduling today recurrent tasks')
    const today = new Date()

    // 1. look for all archived task having `repeat`
    const recurrents = this._storage.get('archive').todayTasks()
    debug(`found ${recurrents.length} tasks to repeat today`)

    const added: string[] = []
    recurrents.ids().forEach((taskId) => {
      const task = recurrents.task(taskId)
      if (task === null)
        throw new Error(`impossible, this should be a task, but typescript disagrees`)
      if (added.includes(task.description))
        return debug(`task ${taskId} already added ${task.description}`)

      const existing = this._data.search([task.description])
      if (existing.ids().length > 0) return debug(`task id:${taskId} already scheduled`)
      // Check we also didn't check it today already. This is normally guarded
      // because this function only runs the first time of the day, but this is
      // done outside and so it should not matter here.
      if (new Date(task.updatedAt).getDate() === today.getDate())
        debug(`task id:${taskId} already completed today`)
      else {
        debug(`rescheduling recurrent task id:${taskId} (${task.repeat})`)
        // very much a new task
        const todayTask = new Task({
          id: this._data.generateID(),
          description: task.description,
          boards: task.boards,
          tags: task.tags,
          priority: task.priority,
          link: task.link || undefined,
          estimate: task.estimate || undefined,
        })
        this._data.set(todayTask.id, todayTask)
        added.push(task.description)

        render.successCreate(todayTask, true)
      }
    })

    debug(`done - comitting new recurrent tasks`)
    this._save(this._data)
  }

  _saveItemToArchive(item: IBullet) {
    const { _data } = this
    const archive = this._storage.get('archive')

    const archiveID = archive.generateID()
    debug(`archiving item under id ${archiveID}`)

    archive.set(archiveID, item)

    this._saveArchive(archive)

    _data.delete(item.id)
  }

  _saveItemToTrashBin(item: IBullet) {
    const { _data } = this
    const bin = this._storage.get('bin')

    const trashID = bin.generateID()
    debug(`trashing item under id ${trashID}`)

    bin.set(trashID, item)

    this._storage.set(bin.all(), 'bin')

    _data.delete(item.id)
  }

  _saveItemToStorage(item: IBullet) {
    const { _data } = this
    const archive = this._storage.get('archive')
    const restoreID = _data.generateID()

    item.id = restoreID
    _data.set(restoreID, item)

    this._save(_data)

    archive.delete(item.id)
  }

  tagItem(desc: string[]) {
    const { description, tags } = parseOptions(desc)
    const ids = description.split(' ')

    const { _data } = this

    ids
      .map((each) => _data.get(each))
      .forEach((item: IBullet) => {
        item.tags = removeDuplicates(tags.concat(item.tags || []))
      })

    this._save(_data)
    render.successEdit(ids.join(', '))
  }

  createNote(desc: string[], notebook?: boolean) {
    const { _data } = this
    const storedBoards = _data.boards()
    const storedTags = this._data.tags()

    const { description, tags, boards } = parseOptions(desc, {
      defaultBoard: config.local.defaultBoard,
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

    if (config.local.enableCopyID) clipboardy.writeSync(String(id))

    render.successCreate(note)

    if (notebook) this.comment(String(id))
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
    debug(`striking tasks ${ids.join(', ')}`)

    // another gymnastics to allow tags in the list of ids
    const { description, tags } = parseOptions(ids, {
      defaultBoard: config.local.defaultBoard,
    })
    ids = this._validateIDs(description.split(' '))
    debug(`task ids verified: ${ids}`)

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
            task.duration > config.local.suspiciousDuration * 60 * 60 * 1000
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
        // TODO: log and print something
        return null
      })
    )

    this._save(_data)

    for (const t of checked) log.info(`checking task ${t.id}`, t)
    for (const t of unchecked) log.info(`un-checking task ${t.id}`)

    render.markComplete(checked)
    render.markIncomplete(unchecked)
  }

  createTask(
    desc: string[],
    cliEstimate?: number,
    link?: string,
    notebook?: boolean,
    renderJSON?: boolean,
    repeat?: string
  ) {
    const { boards, tags, description, priority, estimate } = parseOptions(desc, {
      defaultBoard: config.local.defaultBoard,
    })

    // NOTE: do we want to automatically tag 'every day' and 'every weekday'
    // +habits?

    const { _data } = this

    // NOTE: not sure that's multi-platform
    // we support multi-line strings to batch create multiple tasks
    const lines = description.split('\n')
    const isMultiple = lines.length > 1
    lines.forEach((line: string) => {
      const id = this._data.generateID()
      const task = new Task({
        id,
        description: line,
        boards,
        tags,
        priority,
        link,
        estimate: estimate || cliEstimate,
        repeat,
      })

      if (notebook) task.writeComment(config.local.editor)

      _data.set(id, task)

      if (config.local.enableCopyID && !isMultiple) clipboardy.writeSync(String(id))

      if (renderJSON) console.log(JSON.stringify({ id: task.id, created: task.toJSON() }))
      else render.successCreate(task)
    })

    // commit
    this._save(_data)
  }

  deleteItems(ids: string[], toTrash = false) {
    ids = this._validateIDs(ids)

    const { _data } = this

    ids.forEach((id) => {
      // the operation will also delete `id` from `_data`
      if (toTrash) this._saveItemToTrashBin(_data.get(id))
      else this._saveItemToArchive(_data.get(id))
    })

    this._save(_data)

    render.successDelete(ids)
  }

  /**
   * Pull all archived items, group them by dates of last update, order it, and
   * display wher the date is the board.
   */
  displayArchive() {
    debug('displaying the whole archive, by dates ASC')
    const archive = this._storage.get('archive')

    // first we want to group items by day, in a way that can be the ordered
    // (so don't go to UI-friendly yet)

    const groups = groupByLastUpdateDay(archive)

    render.displayByDate(groups, true)
  }

  displayByBoard() {
    render.displayByBoard(this._data.groupByBoards())
  }

  // expose the render method to our business logic there
  displayByDate() {
    render.displayByDate(groupByLastUpdateDay(this._data))
  }

  displayBoardStats() {
    render.displayStats(this._data.stats())
  }

  editItemProperty(itemId: string, property: string, input: string[]) {
    this._validateIDs([itemId])

    // TODO: parse input to allow boards, tags, etc...

    if (input.length === 0) {
      render.missingDesc()
      process.exit(1)
    }

    const { _data } = this

    const item = _data.get(itemId)
    // TODO: display something if property is none of those fields
    // TODO: validate `input[0]` depending on the cases
    if (property === 'description') item.description = input.join(' ')
    // eslint-disable-next-line prefer-destructuring
    else if (property === 'link') item.link = input[0]
    // eslint-disable-next-line prefer-destructuring
    else if (property === 'duration') item.duration = parseInt(input[0], 10) * 60 * 1000

    this._save(_data)
    render.successEdit(itemId)
  }

  findItems(terms: string[], inArchive: Maybe<boolean>) {
    if (inArchive) {
      const result = this._storage.get('archive').search(terms)
      // searching through archive makes more sense to display by date
      // (we are sure about the type given the `else` above)
      const groups = groupByLastUpdateDay(result as Catalog)
      render.displayByDate(groups)
    } else {
      const result = this._data.search(terms)
      const groups = result.groupByBoards()
      render.displayByBoard(groups)
    }
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

      // everything else is a filtering attribute
      return attributes.push(x)
    })
    boards = removeDuplicates(boards)
    tags = removeDuplicates(tags)
    attributes = removeDuplicates(attributes)

    let data = filterByAttributes(attributes, this._data)
    if (boards.length > 0 || tags.length > 0)
      // filter by boards and/or tags
      data = filterByBoards(boards.concat(tags), data)

    const groups = this._data.groupByBoards(boards.concat(tags))
    render.displayByBoard(groups, showTasks)

    render.displayStats(data.stats())
  }

  moveBoards(input: string[]) {
    const { _data } = this
    let ids: string[] = []
    let boards: string[] = []

    input.filter(isBoardOpt).forEach((board) => {
      boards.push(board)
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
    const archive = this._storage.get('archive')
    ids = this._validateIDs(ids, archive.ids())

    ids.forEach((id) => {
      this._saveItemToStorage(archive.get(id))
    })

    this._saveArchive(archive)
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

    task.setEstimate(estimate, config.local.tshirtSizes)

    this._save(this._data)

    render.successEdit(taskid)
  }

  updatePriority(priority: Priority, taskids: string[]) {
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

  async printTask(taskId: string, format: string, useArchive = false) {
    const store = useArchive ? this._storage.get('archive') : this._storage.get()

      ;[taskId] = this._validateIDs([taskId], store.ids())

    debug(`will focus on task ${taskId} (from ${useArchive ? 'archive' : 'default'})`)

    const task = store.get(taskId)

    if (task === null) throw new Error(`no item with id #${taskId} found`)

    // TODO: html
    if (format === 'markdown') task.toMarkdown()
    // we stringify it so it interoperates better with unix tools like jq. One
    // could combine `jq` and a templating language for example to do pretty
    // cool stuff
    else if (format === 'json') console.log(JSON.stringify(task.toJSON()))
    // should be enforced impossible by the cli or at least caught earlier
    // AND/OR should be pretty printed
    else throw new Error(`unsupported export format: ${format}`)
  }

  beginTask(id: string, useTimer: boolean) {
    ;[id] = this._validateIDs([id])

    // blocking logger to record steps of the timer
    const interactive = new Signale({ interactive: true, scope: 'task.timer' })

    const { _data } = this
    const started: string[] = []
    const paused: string[] = []

    // TODO: else render error
    if (_data.get(id).isTask) {
      const task = _data.task(id)
      // TODO: handle the UI of it
      if (task === null) throw new Error(`item ${id} is not a task`)

      task.begin()

      if (task.inProgress) started.push(id)
      else paused.push(id)

      this._save(_data)

      if (started.length > 0) render.markStarted(started)
      if (paused.length > 0) render.markPaused(paused)

      // this only makes sense when starting to work
      if (useTimer && started.length > 0) {
        // first estimate how long we will block
        // TODO: take into account what has been worked on already (`task.duration`?)
        // TODO: make the tick configurable
        const estimate = task.estimate
          ? task.estimate / 1000 / 60
          : config.local.defaultTaskEstimate
        const msg = `working on: ${task.description} (#${task.id})`

        // capture CTRL-C to gracefully handle it
        process.on('SIGINT', () => {
          // console.log('Caught interrupt signal')

          // TODO: change back the task status to stopped
          // TODO: capture how long has elapsed and update task worked on
          interactive.success(`[timer] interrupted, wrapping up`)
          events.close()

          // NOTE: should i cleanup timeouts?
          process.exit(0)
        })

        // each minute we will update the display
        interactive.await(`[%d/${estimate}] - ${msg}`, 0)
        for (let i = 0; i < estimate; i++) {
          setTimeout(
            () => {
              interactive.await(`[%d/${estimate}] - ${msg}`, i + 1)

              // publish vent
              const payload = { command: 'begin', msg, args: { i, estimate } }
              events.fire('begin.timer', payload)

              if (i >= estimate) {
                interactive.success(`[${estimate}/${estimate}] - completed`)

                // TODO: ask if the task was completed or if more time is needed

                // while udp is connection-less, it seems necessary to close
                // the event loop
                events.close()
              }
            },
            // wait for a minute before next tick
            i * 1000 * 60
          )
        }
      }
    }
  }

  comment(itemId: string) {
    // TODO: _validateIDs
    const { editor } = config.local

    const { _data } = this
    const item = _data.get(itemId)

    item.writeComment(editor)

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
}

export function switchContext(name: string) {
  log.info(`switching to context ${name}`)
  config.update('currentContext', name)

  render.successSwitchContext(name)
}

export function showManual() {
  console.log(help)
}

export default Taskbook
