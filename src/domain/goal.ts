import { LoggerFunc } from 'signale'
import Task, { TaskProperties } from './task'
import Printer, { SignaleLogConfig, wait, success } from '../interfaces/printer'

export default class Goal extends Task {
  readonly _type: string
  private _print: LoggerFunc

  constructor(options: TaskProperties) {
    super(options)

    this._type = 'goal'
    const { custom } = Printer('🎯 goal')
    this._print = custom
  }

  display(signaleObj: SignaleLogConfig) {
    // NOTE: this looks like exactly what the default implementation should be
    if (this.isComplete) success(signaleObj)
    else if (this.inProgress) wait(signaleObj)
    else this._print(signaleObj)
  }
}
