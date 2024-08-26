import { BasicBullet } from './ibullet'
import { note, SignaleLogConfig } from '../interfaces/printer'

export default class Note extends BasicBullet {
  isTask = false

  _type = 'note'

  display(signaleObj: SignaleLogConfig) {
    return note(signaleObj)
  }
}
