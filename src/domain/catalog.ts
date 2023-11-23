import Item from './item'
import Task from './task'
import { Maybe } from '../types'
import config, { IConfig } from '../config'

// base layout of items is { itemId: Item, .... }
export type CatalogInnerData = Record<string, Item>

type FilterOutLogic = (item: Item) => boolean

interface CatalogStats {
  complete: number
  inProgress: number
  pending: number
  notes: number
}

/**
 * Filter the list of current tasks available to the command.
 */
function _filter(data: CatalogInnerData, exclude: FilterOutLogic): CatalogInnerData {
  Object.keys(data).forEach((id) => {
    if (exclude(data[id])) delete data[id]
  })

  return data
}

export default class Catalog {
  protected _items: CatalogInnerData
  protected _configuration: IConfig

  constructor(items: CatalogInnerData) {
    this._items = items
    this._configuration = config.get()
  }

  public generateID(): number {
    const ids = this.ids().map((id) => parseInt(id, 10))
    const max = Math.max(...ids)

    // THE first task
    if (ids.length === 0) return 1

    // pick up the first available id. This allows to recycle ids that have
    // been archived.
    for (let idx = 0; idx < max; idx++) {
      // will return the lowest id that is not in the used list of tasks
      if (!ids.includes(idx)) return idx
    }

    // fallback strategy: keep incrementing
    return max + 1
  }

  private _isComplete(item: Item) {
    return item instanceof Task && item.isComplete
  }

  private _inProgress(item: Item) {
    return item instanceof Task && item.inProgress
  }

  all(): CatalogInnerData {
    return this._items
  }

  ids(): string[] {
    return Object.keys(this._items)
  }

  /**
   * Pull and de-duplicate all items' boards
   */
  public boards(): string[] {
    // TODO: from config
    const boards = [this._configuration.defaultBoard]

    this.ids().forEach((id: string) => {
      boards.push(...this.get(id).boards.filter((x: string) => boards.indexOf(x) === -1))
    })

    return boards
  }

  public tags() {
    const tags: string[] = []

    this.ids().forEach((id) => {
      // TODO: just not sure if that's mandatory
      // if (this.get(id).tags.length ) tags.push(...this.get(id).tags.filter((x) => tags.indexOf(x) === -1))
      tags.push(...this.get(id).tags.filter((x) => tags.indexOf(x) === -1))
    })

    return tags
  }

  get(id: string): Item {
    return this._items[id]
  }

  set(id: number, data: Item) {
    this._items[id] = structuredClone(data)
    // we also overwrite the `_id` as it might be coming from the `storage`,
    // while here we save it to `archive`, under a new id. Obviously this is
    // terrible design.
    this._items[id]._id = id
  }

  delete(id: number) {
    delete this._items[id]
  }

  task(id: string): Maybe<Task> {
    if (!this._items[id].isTask) return null

    return this._items[id] as Task
  }

  notes(): Catalog {
    const items = _filter(this._items, (item) => item.isTask)
    return new Catalog(items)
  }

  tasks(): Catalog {
    const items = _filter(this._items, (item) => !item.isTask)
    return new Catalog(items)
  }

  pending(): Catalog {
    const items = _filter(this._items, (item) => !item.isTask || this._isComplete(item))
    return new Catalog(items)
  }

  completed(): Catalog {
    const items = _filter(this._items, (item) => !item.isTask || !this._isComplete(item))
    return new Catalog(items)
  }

  inProgress(): Catalog {
    const items = _filter(this._items, (item) => !item.isTask || !this._inProgress(item))
    return new Catalog(items)
  }

  starred(): Catalog {
    const items = _filter(this._items, (item) => !item.isStarred)
    return new Catalog(items)
  }

  /**
   * Compile list of task dates,
   * which are the timestamp the task was last updated
   * (or the note and event was created?)
   */
  dates(): string[] {
    const dates: string[] = []

    this.ids().forEach((id) => {
      // for migration purpose, as `updatedAt should always be set`
      let dt = new Date().toDateString()

      if (this.get(id).updatedAt) dt = new Date(this.get(id).updatedAt as number).toDateString()

      // avoid duplicates
      if (dates.indexOf(dt) === -1) dates.push(dt)
    })

    return dates
  }

  public stats(): CatalogStats {
    let [complete, inProgress, pending, notes] = [0, 0, 0, 0]

    this.ids().forEach((id) => {
      if (this.get(id).isTask) {
        return this.task(id)?.isComplete
          ? complete++
          : this.task(id)?.inProgress
            ? inProgress++
            : pending++
      }

      return notes++
    })

    return { complete, inProgress, pending, notes }
  }
}
