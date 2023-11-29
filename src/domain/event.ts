import chalk from 'chalk'
import Printer, { SignaleLogConfig, wait, success } from '../interfaces/printer'
import { ItemProperties } from './item'
import Task from './task'

export interface EventProperties extends ItemProperties {
  schedule: string
  estimate: number
}

const { custom } = Printer('⏲')
// TODO: reading from config once ready
const grey = chalk.cyan.dim

/**
 * Events are tasks to accomplish at the end.
 * They may have priorities, and they can be done, in progress, etc...
 */
export default class EventTask extends Task {
  schedule: string

  constructor(options: EventProperties) {
    super(options)

    // overwrite and make it a specific type of task
    this._type = 'event'
    this.schedule = options.schedule
  }

  display(signaleObj: SignaleLogConfig) {
    // prefix message with scheduled time
    signaleObj.message = `${chalk.blue(this.schedule)} ${signaleObj.message}`

    if (this.duration) signaleObj.suffix = grey(String(this.duration))

    if (this.isComplete) success(signaleObj)
    else if (this.inProgress) wait(signaleObj)
    else custom(signaleObj)
  }
}
