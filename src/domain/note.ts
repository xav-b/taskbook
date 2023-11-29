import Item, { ItemProperties } from './item'
import { note, SignaleLogConfig } from '../interfaces/printer'

export default class Note extends Item {
  readonly isTask: boolean
  readonly _type: string

  constructor(options: ItemProperties) {
    super(options)

    this.isTask = false
    this._type = 'note'
  }

  display(signaleObj: SignaleLogConfig) {
    return note(signaleObj)
  }
}
