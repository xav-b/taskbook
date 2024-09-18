import later from '@breejs/later'

import IBullet, { IBulletOptions } from './ibullet'
import Task from './task'
import Note from '../domain/note'
import CalendarEvent, { EventProperties } from '../plugins/bb-domain-event/event'
import Goal from '../plugins/bb-domain-goal/goal'
import Flashcard from '../plugins/bb-domain-card/card'
import Storage, { RawIBullet, RawCatalog } from '../store'
import { hasTerms } from '../shared/parser'
import { Maybe } from '../types'
import config from '../config'

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

function parseRawItem(item: RawIBullet): IBullet {
  if (item._type === 'task') return new Task(item as IBulletOptions)
  else if (item._type === 'note') return new Note(item as IBulletOptions)
  else if (item._type === 'event') return new CalendarEvent(item as EventProperties)
  else if (item._type === 'goal') return new Goal(item as IBulletOptions)
  else if (item._type === 'flashcard') return new Flashcard(item as IBulletOptions)

  throw new Error(`[warning] unknown item type: ${item._type}`)
}

// NOTE: it is not easy to type `any` because it should be the union of all the
// possible type fields, which introduces a strong coupling... And since it
// needs to be optional, it doesn't even bring much type safety.
function mapFromJson(data: RawCatalog): CatalogInnerData {
  const catalog: CatalogInnerData = {}

  Object.values(data).forEach((each) => (catalog[each.id] = parseRawItem(each)))

  return catalog
}

export default class Catalog {
  bucket: string | undefined

  protected store: Storage

  // internal cache of all items
  protected _items: CatalogInnerData | null

  constructor(store: Storage, bucket?: string, items?: CatalogInnerData) {
    this.store = store
    this.bucket = bucket
    // if not forced at initialisation, this will be lazy loaded on the next
    // cache miss
    this._items = items || null
  }

  /**
   * Find the smallest (and therefore most convenient) integer IDs considering
   * the entire set in store.
   */
  public generateID(): number {
    const ids = this.ids().map((id) => parseInt(id, 10))
    const max = Math.max(...ids)

    // THE first task
    if (ids.length === 0) return 1

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
   */
  public exists(uid: string): boolean {
    // most common case, check item id
    const doesExist = uid in this.ids()
    if (doesExist) return true

    // else give a shot at the _uid
    return Object.values(this.all()).find((each) => each._uid === uid) !== undefined
  }

  get length() {
    return Object.keys(this.all()).length
  }

  all(): CatalogInnerData {
    // cache miss
    if (this._items === null) this._items = mapFromJson(this.store.all(this.bucket))

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

    this.ids().forEach((id: string) => {
      boards.push(...this.get(id).boards.filter((x: string) => boards.indexOf(x) === -1))
    })

    return boards
  }

  public tags() {
    const tags: string[] = []

    this.ids().forEach((id) => {
      // if (this.get(id).tags.length ) tags.push(...this.get(id).tags.filter((x) => tags.indexOf(x) === -1))
      tags.push(...this.get(id).tags.filter((x) => tags.indexOf(x) === -1))
    })

    return tags
  }

  public get(id: string): IBullet {
    // if the whole dataset has been loaded already, it's faster to use the cached hashmap
    if (this._items) return this._items[id]

    // else ask the store
    const item = this.store.get(id, this.bucket)
    if (item === null) throw new Error(`failed to retrieve #${id} from store`)

    return parseRawItem(item)
  }

  public uget(uid: string): Maybe<IBullet> {
    return Object.values(this.all()).find((each) => each._uid === uid) || null
  }

  set(data: IBullet, id = this.generateID()) {
    // we also overwrite the `id` as it might be coming from one bucket,
    // while here we might be saving it to another, having its own constraints
    // of ids. Obviously this is terrible design.
    const item = { ...structuredClone(data), id }

    // if we have a valid cache, update it
    if (this._items) this._items[id] = item

    this.store.upsert(item, undefined, this.bucket)
  }

  edit(itemId: string, properties: Record<string, any>): IBullet {
    const item = this.get(itemId)

    // update our internal data representation
    for (const [key, value] of Object.entries(properties)) {
      // @ts-ignore
      item[key] = value
    }

    // and of course the DB
    this.store.upsert(item, item.id.toString())

    return item
  }

  batchEdit(itemIds: string[], properties: Record<string, any>) {
    const dirty: CatalogInnerData = {}

    itemIds.forEach((id: string) => {
      const item = this.get(id)
      dirty[id] = item

      // update our internal data representation
      for (const [key, value] of Object.entries(properties)) {
        // @ts-ignore
        item[key] = value
      }
      // and of course the DB
      this.store.upsert(item, item.id.toString())
    })

    this.flush()
  }

  delete(id: number) {
    if (this._items) delete this._items[id]

    this.store.delete(id.toString(), this.bucket)
  }

  flush() {
    this.store.commit(this.bucket)
  }

  task(id: string): Maybe<Task> {
    if (this._items) {
      const { isTask } = this._items[id]
      return isTask ? (this._items[id] as Task) : null
    }

    // cache miss
    const item = this.store.get(id, this.bucket) as Task
    return item.isTask ? (item as Task) : null
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
      if (includeLogic(items[id])) innerData[id] = items[id]
    })

    return new Catalog(this.store, this.bucket, innerData)
  }

  todayTasks(): Catalog {
    return this.subcatalog((t) => {
      // not a task
      if (!t.isTask) return true
      // not recurrent
      if (t.repeat === null) return true

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
      if (d && d.includes(today.getDay() + 1)) return false
      if (D && D.includes(today.getDate())) return false
      // this seems to mean 'every day'
      if (D && D.includes(1)) return false

      // exclude the rest
      return true
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

    this.ids().forEach((id) => {
      if (this.get(id).isTask) {
        const task = this.task(id)

        // given the first check it should never happen, so throw it if it does
        // because it's a bug
        if (task === null) throw new Error(`item #${id} is not a task`)

        estimate += task.estimate || 0
        duration += task.duration || 0

        // we actually know it's a task thanks for the first condition
        return task.isComplete ? complete++ : task.inProgress ? inProgress++ : pending++
      }

      // else
      return notes++
    })

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

    this.ids().forEach((id) => {
      boards.forEach((board: string) => {
        if (this.get(id).boards.includes(board) || this.get(id).tags?.includes(board)) {
          // we already have this board with items, append to it
          if (Array.isArray(grouped[board])) grouped[board].push(this.get(id))
          // initialise that `board` group
          else grouped[board] = [this.get(id)]
        }
      })
    })

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
}

// NOTE: this could be made more generic by allowing to pick also `_startedAt`
// and `_createdAt`
export function groupByLastUpdateDay(data: Catalog) {
  const grouped: Record<string, IBullet[]> = {}

  data.ids().forEach((id) => {
    const item = data.get(id)
    // format it as `DD/MM/YYYY`
    const dt = new Date(item.updatedAt).toLocaleDateString('en-UK')

    if (grouped.hasOwnProperty(dt)) grouped[dt].push(item)
    else grouped[dt] = [item]
  })

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
