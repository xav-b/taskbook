import { Signale } from 'signale'
import { prompt } from 'enquirer'
import clipboardy from 'clipboardy'

import { Maybe } from '~/types'
import Storage from '~/store'
import cacheStorage from '../store/localcache'
import LocalStorage from '../store/localjson'
import { help, goodDay } from '../interfaces/text'
import render from '../interfaces/render'
import { removeDuplicates } from '../shared/utils'
import { parseOptions, isBoardOpt } from '../shared/parser'
import Catalog, { groupByLastUpdateDay, filterByAttributes } from '../domain/catalog'
import IBullet, { Priority } from '../domain/ibullet'
import Task from '../domain/task'
import Note from '../domain/note'
import Logger from '../shared/logger'
import events from './events'
import config from '../config'

const log = Logger('core.taskbook')
const cache = cacheStorage.init()

interface Office {
  desk: Catalog
  archive: Catalog
  bin: Catalog
}

class Taskbook {
  isNewDay: boolean

  protected _store: Storage
  // plugins are expected to access it, and anyway catalog is an abstraction
  // meant to be used
  office: Office

  constructor(context = config.state.currentContext) {
    log.info('initialising taskbook')

    log.info(`initialising storage (ctx ${context})`)
    this._store = new LocalStorage(context)
    this.office = {
      desk: new Catalog(this._store),
      archive: new Catalog(this._store, 'archive'),
      bin: new Catalog(this._store, 'bin'),
    }

    // determine if this is the first run of the day
    this.isNewDay = false
    const last = cache.get('root.lastOpen')
    log.debug(`last taskbook run: ${last}`)

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

    log.debug('checking recurrent tasks')
    // the operation is idempotent
    this.scheduleRecurrentTasks()
  }

  _validateIDs(inputIDs: string[], data: Catalog = this.office.desk): void {
    if (inputIDs.length === 0) {
      render.missingID()
      process.exit(1)
    }

    inputIDs = removeDuplicates(inputIDs)

    inputIDs.forEach((id) => {
      if (!data.exists(id)) {
        render.invalidID(id)
        process.exit(1)
      }
    })
  }

  /**
   * Look through recurrent tasks, and if:
   *  - their schedule makes them needed today
   *  - and they don't exist yet
   * Then create a new task
   */
  scheduleRecurrentTasks() {
    log.info('scheduling today recurrent tasks')
    const today = new Date()

    // 1. look for all archived task having `repeat`
    const recurrents = this.office.archive.todayTasks()
    log.debug(`found ${recurrents.length} tasks to repeat today`)

    const added: string[] = []
    recurrents.ids().forEach((taskId) => {
      const task = recurrents.task(taskId)
      if (task === null)
        throw new Error(`impossible, this should be a task, but typescript disagrees`)
      if (added.includes(task.description))
        // very much expected since each completion will add a new instance of
        // that same task that will be picked up. Hacky design...
        return log.debug(`task ${taskId} already added ${task.description}`)

      const existing = this.office.desk.search([task.description])
      if (existing.ids().length > 0) return log.debug(`task id:${taskId} already scheduled`)
      // Check we also didn't check it today already. This is normally guarded
      // because this function only runs the first time of the day, but this is
      // done outside and so it should not matter here.
      // (and anyway this helps with idempotency)
      if (new Date(task.updatedAt).getDate() === today.getDate())
        log.debug(`task id:${taskId} already completed today`)
      else {
        log.info(`rescheduling recurrent task id:${taskId} (${task.repeat})`)
        // very much a new task
        const todayTask = new Task({
          id: this.office.desk.generateID(),
          description: task.description,
          boards: task.boards,
          tags: task.tags,
          priority: task.priority,
          link: task.link || undefined,
          estimate: task.estimate || undefined,
          // since the task already exist in the archive with the property (we
          // found it just now) it would not be strictly necessary. But the
          // property a) is correct and b) enables the `repeat` visual hint
          repeat: task.repeat || undefined,
        })
        this.office.desk.set(todayTask, todayTask.id)
        added.push(task.description)

        render.successCreate(todayTask, true)
      }
    })

    log.info(`done - comitting new recurrent tasks`)
    this.office.desk.flush()
  }

  tagItem(desc: string[]) {
    const { description, tags } = parseOptions(desc)
    const ids = description.split(' ')

    ids
      .map((each) => this.office.desk.get(each))
      .forEach((item: IBullet) => {
        item.tags = removeDuplicates(tags.concat(item.tags || []))
        this.office.desk.set(item, item.id)
      })

    this.office.desk.flush()
    render.successEdit(ids.join(', '))
  }

  createNote(desc: string[], notebook?: boolean) {
    const storedBoards = this.office.desk.boards()
    const storedTags = this.office.desk.tags()

    const { description, tags, boards } = parseOptions(desc, {
      defaultBoard: config.local.defaultBoard,
    })
    const id = this.office.desk.generateID()
    const note = new Note({ id, description, tags, boards })

    // warn on new tags and boards
    tags.forEach((t) => {
      if (!storedTags.includes(t)) render.warning(note.id, `new tag: ${t}`)
    })
    boards.forEach((b) => {
      if (!storedBoards.includes(b)) render.warning(note.id, `new board: ${b}`)
    })

    this.office.desk.set(note, id)
    this.office.desk.flush()

    if (config.local.enableCopyID) clipboardy.writeSync(String(id))

    render.successCreate(note)

    if (notebook) this.comment(String(id))
  }

  copyToClipboard(itemId: string) {
    this._validateIDs([itemId])

    clipboardy.writeSync(this.office.desk.get(itemId).description)

    render.successCopyToClipboard([itemId])
  }

  async checkTasks(ids: string[], duration: Maybe<number>, doneAt: Maybe<Date>) {
    log.info(`striking tasks ${ids.join(', ')}`)

    // another gymnastics to allow tags in the list of ids
    const { description, tags } = parseOptions(ids, {
      defaultBoard: config.local.defaultBoard,
    })
    this._validateIDs(description.split(' '))

    const checked: Task[] = []
    const unchecked: Task[] = []

    await Promise.all(
      ids.map(async (id) => {
        if (this.office.desk.get(id).isTask) {
          const task = this.office.desk.task(id)
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

          this.office.desk.set(task, task.id)

          return task.isComplete ? checked.push(task) : unchecked.push(task)
        }

        // else invalid item id
        // TODO: log and print something
        return null
      })
    )

    this.office.desk.flush()

    // fire events
    for (const t of checked) {
      log.debug(`firing udp event for task #${t.id} checked`)
      const payload = { command: 'check', msg: `checked task #${t.id}`, args: t }
      await events.fire('task checked', payload)
      log.info(`checking task ${t.id}`, t)
    }
    for (const t of unchecked) log.info(`un-checking task ${t.id}`)

    render.markComplete(checked)
    render.markIncomplete(unchecked)

    events.close()
  }

  createTask(
    desc: string[],
    comment?: string,
    cliEstimate?: number,
    link?: string,
    notebook?: boolean,
    repeat?: string
  ): Task[] {
    const created: Task[] = []
    const { boards, tags, description, priority, estimate } = parseOptions(desc, {
      defaultBoard: config.local.defaultBoard,
    })

    // NOTE: do we want to automatically tag 'every day' and 'every weekday'
    // +habits?

    // NOTE: not sure that's multi-platform
    // we support multi-line strings to batch create multiple tasks
    const lines = description.split('\n')
    const isMultiple = lines.length > 1
    lines.forEach((line: string) => {
      const id = this.office.desk.generateID()
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

      if (comment) task.writeComment(comment)
      else if (notebook) task.writeCommentInEditor(config.local.editor)

      this.office.desk.set(task, id)

      if (config.local.enableCopyID && !isMultiple) clipboardy.writeSync(String(id))

      created.push(task)
    })

    this.office.desk.flush()

    return created
  }

  transfer(items: IBullet[], targetBucket?: string, fromBucket?: string) {
    if (targetBucket === undefined && fromBucket === undefined)
      throw new Error('cant transfer if both storages are missing')

    const fromCatalog =
      fromBucket === undefined ? this.office.desk : new Catalog(this._store, fromBucket)
    const targetCatalog =
      targetBucket === undefined ? this.office.desk : new Catalog(this._store, targetBucket)

    this._validateIDs(items.map((each) => each.id.toString(), fromCatalog))

    items.forEach((each) => {
      log.info(`moving item #${each.id} to ${targetBucket}`)
      // since we omit the second argument, a new ID will be generated
      // specifically for that storage
      targetCatalog.set(each)

      // transfer done, delete the original
      fromCatalog.delete(each.id)
    })

    // indicate to catalog and storage we're done with updates
    targetCatalog.flush()
    fromCatalog.flush()
  }

  deleteItems(ids: string[], toTrash = false) {
    this.transfer(
      ids.map((each) => this.office.desk.get(each)),
      toTrash ? 'bin' : 'archive'
    )
  }

  /**
   * Pull all archived items, group them by dates of last update, order it, and
   * display wher the date is the board.
   */
  displayArchive() {
    log.info('displaying the whole archive, by dates ASC')

    // first we want to group items by day, in a way that can be the ordered
    // (so don't go to UI-friendly yet)
    const groups = groupByLastUpdateDay(this.office.archive)

    render.displayByDate(groups, true)
  }

  // expose the render method to our business logic there
  displayByDate() {
    render.displayByDate(groupByLastUpdateDay(this.office.desk))
  }

  displayBoardStats() {
    render.displayStats(this.office.desk.stats())
  }

  editItemProperty(itemId: string, property: string, input: string[]) {
    this._validateIDs([itemId])

    // TODO: parse input to allow boards, tags, etc...

    if (input.length === 0) {
      render.missingDesc()
      process.exit(1)
    }

    const item = this.office.desk.get(itemId)
    // TODO: display something if property is none of those fields
    // TODO: validate `input[0]` depending on the cases
    if (property === 'description') item.description = input.join(' ')
    // eslint-disable-next-line prefer-destructuring
    else if (property === 'link') item.link = input[0]
    // eslint-disable-next-line prefer-destructuring
    else if (property === 'duration') item.duration = parseInt(input[0], 10) * 60 * 1000

    this.office.desk.set(item, item.id)
    this.office.desk.flush()

    render.successEdit(itemId)
  }

  findItems(terms: string[], inArchive: Maybe<boolean>) {
    if (inArchive) {
      const result = new Catalog(this._store, 'archive').search(terms)
      // searching through archive makes more sense to display by date
      // (we are sure about the type given the `else` above)
      const groups = groupByLastUpdateDay(result as Catalog)
      render.displayByDate(groups)
    } else {
      const result = this.office.desk.search(terms)
      const groups = result.groupByBoards()
      render.displayByBoard(groups)
    }
  }

  /**
   * Detect tags, boards or pre-defined "statuses" to filter (as AND) the whole
   * board and nicely display by boards.
   */
  listByAttributes(terms: string[]): { data: Catalog; groups?: string[] } {
    let boards: string[] = []
    let tags: string[] = []
    let attributes: string[] = []
    const storedBoards = this.office.desk.boards()
    const storedTags = this.office.desk.tags()

    // no filtering
    if (terms.includes('all')) return { data: this.office.desk }

    // parse boards and tags among the filtering properties
    terms.forEach((x) => {
      if (storedBoards.indexOf(`@${x}`) >= 0) boards.push(`@${x}`)

      if (storedTags.indexOf(`+${x}`) >= 0) tags.push(`+${x}`)

      // everything else is a filtering attribute
      return attributes.push(x)
    })
    boards = removeDuplicates(boards)
    tags = removeDuplicates(tags)
    attributes = removeDuplicates(attributes)
    // we want to group filtered result by boards and tags
    const groups = boards.concat(tags)

    // then it's a 2 steps affair: filter by attributes and filter by tags + boards.
    // We should end up with a shrinked catalogs, ready to be used for rendering
    // or stats.
    let data = filterByAttributes(attributes, this.office.desk)
    if (boards.length > 0 || tags.length > 0)
      // filter by boards and/or tags
      data = data.filterByBoards(boards.concat(tags))

    return { data, groups }
  }

  async moveBoards(input: string[]) {
    const ids: string[] = []
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

    this._validateIDs(ids)

    ids.forEach((id) => {
      this.office.desk.edit(id, { boards })
    })

    this.office.desk.flush()

    render.successMove(ids.join(', '), boards)

    const payload = { command: 'move', msg: `moved tasks`, args: { ids, boards } }
    await events.fire('tasks moved', payload)
    events.close()
  }

  restoreItems(ids: string[]) {
    this.transfer(
      ids.map((each) => this.office.desk.get(each)),
      undefined,
      'archive'
    )
  }

  starItems(ids: string[]) {
    this._validateIDs(ids)

    const starred: string[] = []
    const unstarred: string[] = []

    ids.forEach((id) => {
      // toggle it
      const item = this.office.desk.get(id)
      item.isStarred = !item.isStarred
      this.office.desk.set(item, item.id)
      return item.isStarred ? starred.push(id) : unstarred.push(id)
    })

    this.office.desk.flush()

    render.markStarred(starred)
    render.markUnstarred(unstarred)
  }

  estimateWork(taskid: string, estimate: number) {
    this._validateIDs([taskid])

    const task = this.office.desk.task(taskid)

    if (task === null) throw new Error(`item ${taskid} is not a task`)

    task.setEstimate(estimate, config.local.tshirtSizes)
    this.office.desk.set(task, task.id)

    this.office.desk.flush()

    render.successEdit(taskid)
  }

  updatePriority(priority: Priority, taskids: string[]) {
    this._validateIDs(taskids)

    this.office.desk.batchEdit(taskids, { priority })

    render.successPriority(taskids.join(', '), priority)
  }

  clear(alsoNotes = true) {
    const ids: string[] = []

    this.office.desk.ids().forEach((id) => {
      const item = this.office.desk.get(id)

      if (item instanceof Task && item.isComplete) ids.push(id)
      else if (item instanceof Note && alsoNotes) ids.push(id)
      // else not something we want to clear
    })

    if (ids.length === 0) return

    this.deleteItems(ids)
    render.successDelete(ids)
  }

  // FIXME: doesn't have to be a task, works for any ibullet
  async printTask(taskId: string, format: string, useArchive = false) {
    const catalog = useArchive ? new Catalog(this._store, 'archive') : this.office.desk

    this._validateIDs([taskId], catalog)

    log.info(`will focus on task ${taskId} (from ${useArchive ? 'archive' : 'default'})`)

    const task = catalog.get(taskId)

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
    this._validateIDs([id])

    // blocking logger to record steps of the timer
    const interactive = new Signale({ interactive: true, scope: 'task.timer' })

    const started: string[] = []
    const paused: string[] = []

    // TODO: else render error
    if (this.office.desk.get(id).isTask) {
      const task = this.office.desk.task(id)
      // TODO: handle the UI of it
      if (task === null) throw new Error(`item ${id} is not a task`)

      task.begin()

      if (task.inProgress) started.push(id)
      else paused.push(id)

      this.office.desk.set(task, task.id)
      this.office.desk.flush()

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
              events.fire('task timer updated', payload)

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
    this._validateIDs([itemId])

    const { editor } = config.local

    const item = this.office.desk.get(itemId)

    item.writeCommentInEditor(editor)

    this.office.desk.set(item, item.id)
    this.office.desk.flush()

    render.successEdit(itemId)
  }

  /**
   * Offer an easy place to loop through all items and apply/backfill logic.
   */
  _migrate() {
    // this.office.desk.ids().forEach((id) => {
    // if (!_data.get(id)._uid) _data.get(id)._uid = nanoid()
    // })

    this.office.desk.flush()
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
