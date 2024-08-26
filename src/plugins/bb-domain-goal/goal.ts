import Task from '../../domain/task'
import Printer, { SignaleLogConfig, wait, success } from '../../interfaces/printer'

const { custom } = Printer('🎯 goal')

export default class Goal extends Task {
  _type = 'goal'

  display(signaleObj: SignaleLogConfig) {
    // NOTE: this looks like exactly what the default implementation should be
    if (this.isComplete) success(signaleObj)
    else if (this.inProgress) wait(signaleObj)
    else custom(signaleObj)
  }
}
