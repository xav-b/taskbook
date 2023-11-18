import Item, { ItemProperties } from './item'

export default class Note extends Item {
  readonly isTask: boolean
  readonly _type: string

  constructor(options: ItemProperties) {
    super(options)

    this.isTask = false
    this._type = 'note'
  }
}
