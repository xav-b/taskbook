import vim from './vim'
import IBullet from '../../domain/ibullet'
import { Maybe } from '../../types'

export interface TaskbookEditor {
  write: (item: IBullet, content?: string) => string
  read: (item: IBullet) => Maybe<string>
}

export default {
  vim,
}
