import { ItemProperties } from './item'
import Task from './task'

export interface EventProperties extends ItemProperties {
  schedule: string
  estimate: number
}

/**
 * Events are tasks to accomplish at the end.
 * They may have priorities, and they can be done, in progress, etc...
 */
export default class EventTask extends Task {
  schedule: string
  estimate: number

  constructor(options: EventProperties) {
    super(options)

    // overwrite and make it a specific type of task
    this._type = 'event'

    this.schedule = options.schedule
    this.estimate = options.estimate * 60 * 1000
  }
}
