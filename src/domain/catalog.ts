import Item from './item'
import Task from './task'
import { hasTerms } from '../shared/parser'
import { Maybe } from '../types'
import config, { IConfig } from '../config'

// base layout of items is { itemId: Item, .... }
export type CatalogInnerData = Record<string, Item>

type FilterOutLogic = (item: Item) => boolean

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

  /**
   * Unlike other methods, use the internal id to check for existence.
   */
  public exists(uid: string): boolean {
    return Object.values(this.all()).find((each) => each._uid === uid) !== undefined
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
    const boards = [this._configuration.defaultBoard]

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

  public get(id: string): Item {
    return this._items[id]
  }

  public uget(uid: string): Maybe<Item> {
    return Object.values(this.all()).find((each) => each._uid === uid) || null
  }

  set(id: number, data: Item) {
    this._items[id] = structuredClone(data)
    // we also overwrite the `id` as it might be coming from the `storage`,
    // while here we save it to `archive`, under a new id. Obviously this is
    // terrible design.
    this._items[id].id = id
  }

  delete(id: number) {
    delete this._items[id]
  }

  task(id: string): Maybe<Task> {
    if (!this._items[id].isTask) return null

    return this._items[id] as Task
  }

  search(terms: string[]): Catalog {
    const result: CatalogInnerData = {}

    this.ids().forEach((id) => {
      if (!hasTerms(this.get(id).description, terms)) return

      result[id] = this.get(id)
    })

    return new Catalog(result)
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

      return notes++
    })

    return { complete, inProgress, pending, notes, estimate, duration }
  }
}
