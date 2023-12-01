import Item, { ItemProperties } from './item'
import { note, SignaleLogConfig } from '../interfaces/printer'

export default class Note extends Item {
  isTask = false
  _type = 'note'

  constructor(options: ItemProperties) {
    super(options)
  }

  display(signaleObj: SignaleLogConfig) {
    return note(signaleObj)
  }
}
