import { prompt } from 'enquirer'
import later from '@breejs/later'
import { eq, and, inArray } from 'drizzle-orm'
import { type LibSQLDatabase } from 'drizzle-orm/libsql'

import * as schema from '../store/drizzle/schema'
import db from '../store/drizzle/db'
import IBullet, { IBulletOptions } from './ibullet'
import Task from './task'
import Note from '../domain/note'
import CalendarEvent, { EventProperties } from '../plugins/bb-domain-event/event'
import Goal from '../plugins/bb-domain-goal/goal'
import Flashcard from '../plugins/bb-domain-card/card'
import Logger from '../shared/logger'
import { hasTerms } from '../shared/parser'
import { Maybe } from '../types'
import config from '../config'

const log = Logger('domain.catalog')

type BulletRow = typeof schema.bullets.$inferInsert

// base layout of items is { itemId: IBullet, .... }
export type CatalogInnerData = Record<string, IBullet>

type FilterLogic = (item: IBullet) => boolean

export interface CatalogStats {
  complete: number
  pending: number
  notes: number
  // `render` method is quite resilient and accept mostly everything as
  // optional. And with our subtask detection we do leverage this to only
  // display some of those stats (there's no way to know estimate and duration
  // there for example and that's fine)
  inProgress?: number
  estimate?: number
  duration?: number
}

export function parseRawItem(row: BulletRow): IBullet {
  // 1. remap to IBulletOptions
  const item: IBulletOptions = {
    ...row,
    id: row.ctx_id,
    _uid: row.id,
    _type: row.bulletType,
    _createdAt: row.createdAt,
  }

  // 2. applythe right class
  if (row.bulletType === 'task') return new Task(item as IBulletOptions)
  else if (row.bulletType === 'note') return new Note(item as IBulletOptions)
  else if (row.bulletType === 'event') return new CalendarEvent(item as EventProperties)
  else if (row.bulletType === 'goal') return new Goal(item as IBulletOptions)
  else if (row.bulletType === 'flashcard') return new Flashcard(item as IBulletOptions)

  throw new Error(`[warning] unknown item type: ${row.bulletType}`)
}

// NOTE: it is not easy to type `any` because it should be the union of all the
// possible type fields, which introduces a strong coupling... And since it
// needs to be optional, it doesn't even bring much type safety.
// TODO: remove the exprot, TMP
export function mapFromJson(data: BulletRow[]): CatalogInnerData {
  const catalog: CatalogInnerData = {}

  Object.values(data).forEach((each) => (catalog[each.ctx_id] = parseRawItem(each)))

  return catalog
}

export default class Catalog {
  context: string
  bucket: string
  db: LibSQLDatabase<typeof schema>

  // internal cache of all items
  protected _items: CatalogInnerData

  constructor(context?: string, bucket?: string, items?: CatalogInnerData) {
    // NOTE: both could also simply default to null, but it does make some
    // querying simpler with drizzle
    this.context = context || 'default'
    this.bucket = bucket || 'desk'
    // force an initialisation or initialise an empty cache
    this._items = items || {}

    this.db = db.connect({ logger: process.env.TB_DEBUG === 'true' })
  }

  // NOTE: maybe they should ints, we're talking about the ui ids
  async loadCache(itemIds?: string[]) {
    if (this._items.length) log.warn(`catalog cache will be overwritten by: ${itemIds || 'all'}`)

    // TODO: if itemIds were provided, filter in the query
    log.info(`loading catalog '${this.context}/${this.bucket}' cache: ${itemIds || 'all'}`)
    const data = await this.db
      .select()
      .from(schema.bullets)
      .where(and(eq(schema.bullets.context, this.context), eq(schema.bullets.bucket, this.bucket)))
      .all()

    this._items = mapFromJson(data)
  }

  /**
   * Find the smallest (and therefore most convenient) integer IDs considering
   * the entire set in store.
   */
  public generateID(): number {
    const ids = this.ids().map((id) => parseInt(id, 10))

    // THE first task
    if (ids.length === 0) return 1

    const max = Math.max(...ids)
    // pick up the first available id. This allows to recycle ids that have
    // been moved to other buckets.
    for (let idx = 0; idx < max; idx++) {
      // will return the lowest id that is not in the used list of tasks
      if (!ids.includes(idx)) return idx
    }

    // fallback strategy: keep incrementing
    return max + 1
  }

  /**
   * Unlike other methods, use the internal id to check for existence.
   * TODO: support to look into
   */
  public exists(uid: string): boolean {
    // most common case, check item id
    const doesExist = this.ids().includes(uid)
    if (doesExist) return true

    // else give a shot at the _uid (no use case though)
    return Object.values(this.all()).find((each) => each._uid === uid) !== undefined
  }

  get length() {
    return Object.keys(this.all()).length
  }

  all(): CatalogInnerData {
    // TODO: cache miss
    return this._items
  }

  ids(): string[] {
    return Object.keys(this.all())
  }

  /**
   * Pull and de-duplicate all items' boards
   */
  public boards(): string[] {
    const boards = [config.local.defaultBoard]

    for (const item of Object.values(this.all())) {
      boards.push(...item.boards.filter((x: string) => boards.indexOf(x) === -1))
    }

    return boards
  }

  public tags() {
    const tags: string[] = []

    for (const item of Object.values(this.all())) {
      tags.push(...item.tags.filter((x) => tags.indexOf(x) === -1))
    }

    return tags
  }

  public async getMulti(ids: string[]): Promise<Array<IBullet | null>> {
    // check the cache first
    const cached: IBullet[] = []
    for (const id of ids) if (id in this._items) cached.push(this._items[id])

    // we found everything, that's it
    if (ids.length === cached.length) return cached

    const rows = await this.db
      .select()
      .from(schema.bullets)
      .where(
        and(
          inArray(
            schema.bullets.ctx_id,
            ids.map((each) => parseInt(each, 10))
          ),
          eq(schema.bullets.context, this.context),
          eq(schema.bullets.bucket, this.bucket)
        )
      )
      .all()

    return rows.map((each) => {
      if (!each) return null
      return parseRawItem(each)
    })
  }

  // TODO: this could be undefined/null. In fact supporting this avoids to have
  // to check the ids at the start everywhere
  public async get(id: string): Promise<IBullet | null> {
    // if the whole dataset has been loaded already, it's faster to use the cached hashmap
    if (id in this._items) return this._items[id]

    // somehow this below doesn't works
    // const row = await this.db.query.bullets.findFirst({
    //   where: eq(schema.bullets.ctx_id, parseInt(id, 10)),
    // })
    // we also don't `limit(1)` so we can detect issues
    const rows = await this.db
      .select()
      .from(schema.bullets)
      .where(
        and(
          eq(schema.bullets.context, this.context),
          eq(schema.bullets.bucket, this.bucket),
          eq(schema.bullets.ctx_id, parseInt(id, 10))
        )
      )

    if (!rows) return null
    if (rows.length !== 1) throw new Error(`fetching #${id} had unexpected results: ${rows.length}`)

    return parseRawItem(rows[0])
  }

  public uget(uid: string): Maybe<IBullet> {
    return Object.values(this.all()).find((each) => each._uid === uid) || null
  }

  // TODO: rename create/upsert
  async set(data: IBullet, id = this.generateID()): Promise<number> {
    // we also overwrite the `id` as it might be coming from one bucket,
    // while here we might be saving it to another, having its own constraints
    // of ids. Obviously this is terrible design.
    const item = { ...structuredClone(data), id }

    // if we have a valid cache, update it
    if (this._items) this._items[id] = item
    console.log('DEBUG', 'UPDATED CACHE', id)

    const toOverwrite: Partial<BulletRow> = {
      isStarred: data.isStarred,
      description: data.description,
      comment: data.comment,
      link: data.link,
      priority: data.priority,
      repeat: data.repeat,
      schedule: data.schedule,

      boards: data.boards,
      tags: data.tags,

      duration: data.duration,
      estimate: data.estimate,
    }
    const bullet = {
      id: data._uid,
      ctx_id: id,

      context: this.context,
      bucket: this.bucket,

      bulletType: data._type,
      isTask: data.isTask,

      ...toOverwrite,
    } as BulletRow

    await this.db
      .insert(schema.bullets)
      .values(bullet)
      .onConflictDoUpdate({
        target: [schema.bullets.bucket, schema.bullets.context, schema.bullets.ctx_id],
        set: toOverwrite,
      })

    return id
  }

  // FIXME: this only works if we provide the intersection of IBullet and
  // BulletRow, otherwise the internal cache and db update will diverge
  async edit(itemId: string, properties: Partial<BulletRow>): Promise<IBullet | null> {
    const item = await this.get(itemId)
    if (item === null) return null

    // update our internal data representation
    for (const [key, value] of Object.entries(properties)) {
      // @ts-ignore
      item[key] = value
    }

    // and of course the DB
    await this.db
      .update(schema.bullets)
      .set(properties)
      .where(eq(schema.bullets.ctx_id, parseInt(itemId)))

    return item
  }

  /**
   * Run the same update across several ids, and update the cache.
   *
   * If an id is invalid though the update will just end up ignored (since IN
   * (1, 3, ...) will simply not match). This means it's the caller
   * responsability to detect first such issue and render it to the frontend.
   */
  async batchEdit(itemIds: string[], properties: Partial<BulletRow>) {
    log.info(`batch editing ${itemIds.join(', ')}`, properties)

    for (const id of itemIds) {
      // update our internal data representation
      for (const [key, value] of Object.entries(properties)) {
        // @ts-ignore
        if (id in this._items) this._items[id][key] = value
      }
    }

    // and of course the DB
    await this.db
      .update(schema.bullets)
      .set(properties)
      .where(
        and(
          inArray(schema.bullets.ctx_id, itemIds.map(parseInt)),
          eq(schema.bullets.context, this.context),
          eq(schema.bullets.bucket, this.bucket)
        )
      )
  }

  async delete(id: number) {
    if (this._items) delete this._items[id]

    await this.db.delete(schema.bullets).where(eq(schema.bullets.ctx_id, id))
  }

  async transfer(ids: number[], bucketTo: string) {
    log.info(`transfering items from ${this.bucket} to ${bucketTo}`, ids)

    const targetCatalog = new Catalog(this.context, bucketTo)
    // we will need everything in memory to find the most suitable new IDs
    await targetCatalog.loadCache()

    for (const id of ids) {
      // first we need a valid id in the new bucket
      const targetId = targetCatalog.generateID()
      log.info(`freeing id ${id} to the new ${targetId} in ${this.context}/${bucketTo}`)

      // update target catallog internal cache
      // FIXME: if this.loadCache() has not been called, it will not find it and crash
      targetCatalog._items[targetId] = this._items[id.toString()]
      targetCatalog._items[targetId].id = targetId
      // and this one too
      delete this._items[id]

      // then we can transfer it
      await this.db
        .update(schema.bullets)
        .set({
          ctx_id: targetId,
          bucket: bucketTo,
        })
        .where(
          and(
            eq(schema.bullets.context, this.context),
            eq(schema.bullets.bucket, this.bucket),
            eq(schema.bullets.ctx_id, id)
          )
        )
    }
  }

  /**
   * Syntax sugar to validate the requested item is a task
   */
  async task(id: string): Promise<Maybe<Task>> {
    if (id in this._items) {
      const { isTask } = this._items[id]
      return isTask ? (this._items[id] as Task) : null
    }

    const item = await this.get(id)
    return item?.isTask ? item : null
  }

  search(terms: string[]): Catalog {
    return this.subcatalog((item) => hasTerms(item.description, terms))
  }

  notes(): Catalog {
    return this.subcatalog((item) => item._type === 'note')
  }

  tasks(): Catalog {
    return this.subcatalog((item) => item.isTask)
  }

  subcatalog(includeLogic: FilterLogic, items = this.all()): Catalog {
    const innerData: CatalogInnerData = {}

    Object.keys(items).forEach((id) => {
      // @ts-ignore
      if (includeLogic(items[id])) innerData[id] = items[id]
    })

    return new Catalog(this.context, this.bucket, innerData)
  }

  todayTasks(): Catalog {
    return this.subcatalog((t) => {
      // not a task
      if (!t.isTask) return false
      // not recurrent
      if (t.repeat === null) return false

      // so now we have a recurrent task - let's check if it is due today
      const { repeat } = t
      const schedule = later.parse.text(repeat || '')
      // FIXME: don't know how the error system works, can be `6` and works,
      // for `every day` for example
      // if (schedule.error >= 0) throw new Error(`Error while parsing '${repeat}'`)
      if (schedule.schedules.length === 0) throw new Error(`Unsupported schedule '${repeat}'`)

      const today = new Date()
      // TODO: handle more properites of `later`
      // TODO: handle schedule.exceptions
      // TODO: handle the whole array
      // `d` is the day of the week, `D` is the day of the month
      const { D, d } = schedule.schedules[0]
      if (d && d.includes(today.getDay() + 1)) return true
      if (D && D.includes(today.getDate())) return true
      // this seems to mean 'every day'
      if (D && D.includes(1)) return true

      // exclude the rest
      return false
    })
  }

  pending(): Catalog {
    return this.subcatalog((item) => item.isTask && !item.isComplete)
  }

  completed(): Catalog {
    return this.subcatalog((item) => item.isTask && item.isComplete)
  }

  inProgress(): Catalog {
    return this.subcatalog((item) => item.isTask && item.inProgress)
  }

  starred(): Catalog {
    return this.subcatalog((item) => item.isStarred)
  }

  public stats(): CatalogStats {
    let [complete, inProgress, pending, notes, estimate, duration] = [0, 0, 0, 0, 0, 0]

    const library = this.all()
    for (const item of Object.values(library)) {
      if (item.isTask) {
        estimate += item.estimate || 0
        duration += item.duration || 0

        // we actually know it's a task thanks for the first condition
        item.isComplete ? complete++ : item.inProgress ? inProgress++ : pending++
      } else {
        notes++
      }
    }

    return { complete, inProgress, pending, notes, estimate, duration }
  }

  public filterByBoards(boards: string[]): Catalog {
    return this.subcatalog((item) => {
      // if any of the boards is the item's board or tag, retain
      // boards.forEach((board: string) => {
      for (const board of boards) {
        if (item.boards.includes(board) || item.tags.includes(board)) return true
      }

      return false
    })
  }

  public groupByBoards(boards?: string[]) {
    const grouped: Record<string, IBullet[]> = {}

    // by default group by boards and tags
    if (boards === undefined) boards = this.boards()

    // TODO: not sure that's expected. If somehow the list of boards is empty,
    // then there's just nothing to group with, no need to fallback silently on
    // something else
    if (boards.length === 0) boards = this.boards()

    for (const item of Object.values(this.all())) {
      for (const board of boards) {
        if (item.boards.includes(board) || item.tags?.includes(board)) {
          // we already have this board with items, append to it
          if (Array.isArray(grouped[board])) grouped[board].push(item)
          // initialise that `board` group
          else grouped[board] = [item]
        }
      }
    }

    // re-order the way `boards` were given
    const orderInit: Record<string, IBullet[]> = {}
    const ordered = boards.reduce((obj, key) => {
      if (grouped[key]) obj[key] = grouped[key]
      return obj
    }, orderInit)

    return ordered
  }

  public toJSON(): Record<string, any> {
    return Object.entries(this.all()).map(([, item]) => item.toJSON())
  }

  async completeTask(
    taskId: string,
    tags?: string[],
    duration?: Maybe<number>,
    doneAt?: Maybe<Date>
  ): Promise<Task | null> {
    const task = await this.task(taskId)
    if (task === null) return null

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

    log.debug(`updating cache and db of task #${task.id}`)
    // update cache
    this._items[task.id] = task

    // update db
    await this.db
      .update(schema.bullets)
      .set({
        isComplete: task.isComplete,
        inProgress: task.inProgress,
        duration: task.duration,
        tags: task.tags,
        updatedAt: task.updatedAt,
      })
      .where(eq(schema.bullets.ctx_id, task.id))

    return task
  }
}

// NOTE: this could be made more generic by allowing to pick also `_startedAt`
// and `_createdAt`
export function groupByLastUpdateDay(data: Catalog) {
  const grouped: Record<string, IBullet[]> = {}

  for (const item of Object.values(data.all())) {
    // format it as `DD/MM/YYYY`
    const dt = new Date(item.updatedAt).toLocaleDateString('en-UK')

    if (grouped.hasOwnProperty(dt)) grouped[dt].push(item)
    else grouped[dt] = [item]
  }

  return grouped
}

// NOTE: not sure if those funcions should be member of the class. It would a
// nice abstraction, but I also like functional and it doesn't really matter.
// Maybe it would with more testing though...
export function filterByAttributes(attr: string[], data: Catalog) {
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
