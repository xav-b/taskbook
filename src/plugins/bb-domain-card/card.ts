import Printer, { SignaleLogConfig, success } from '../../interfaces/printer'
import config from '../../config'
import Task from '../../domain/task'

const { custom } = Printer('🂡')
const { grey } = config.theme

/*
 * Logically, a card is an item you are tasked to regularly review.
 */
export default class FlashcardTask extends Task {
  _type = 'flashcard'

  display(signaleObj: SignaleLogConfig) {
    // just playing around
    signaleObj.suffix = grey('next: 3d')

    if (this.isComplete) success(signaleObj)
    else custom(signaleObj)
  }
}
