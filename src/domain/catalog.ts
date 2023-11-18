import Item from './item'
import Task from './task'
import { Maybe } from '../types'

// base layout of items is { itemId: Item, .... }
export type CatalogInnerData = Record<string, Item>

type FilterOutLogic = (item: Item) => boolean

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

  constructor(items: CatalogInnerData) {
    this._items = items
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
    const boards = ['My Board']

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
    this._items[id] = data
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
}
