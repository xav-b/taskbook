import chalk from 'chalk'

import Printer, { SignaleLogConfig, wait, success } from '../../interfaces/printer'
import IBullet, { IBulletOptions } from '../../domain/ibullet'
import { UnixTimestamp } from '../../types'
import Task from '../../domain/task'
import config from '../../config'

/**
 * Render a unix timestamp to, e.g., 10:30am
 */
function prettyToday(ts: UnixTimestamp) {
  const dt = new Date(ts)

  // TODO: we could make it configurable to show either 04:00pm or 16:00
  const startH = dt.getHours()
  const startHStr = startH < 10 ? `0${startH}` : String(startH)

  const startM = dt.getMinutes()
  const startMStr = startM < 10 ? `0${startM}` : String(startM)

  const xm = startH >= 12 ? 'pm' : 'am'

  return `${startHStr}:${startMStr}${xm}`
}

/*
 * Logically, an event is a scheduled task.
 *
 * TODO: this would be logical to add `schedule` to the `Task` or even
 * `IBullet` domains. Even a note or a goal could very much be scheduled.
 */
export interface EventProperties extends IBulletOptions {
  // in fact `schedule` is alrady a member of IBulletOptions, we just make it
  // mandatory here, in the case of an event
  schedule: UnixTimestamp
}

const { custom } = Printer('⏲')
const { grey } = config.theme

/**
 * Events are tasks to accomplish at the end.
 * They may have priorities, and they can be done, in progress, etc...
 */
export default class EventTask extends Task {
  schedule: UnixTimestamp

  _type = 'event'

  constructor(options: EventProperties) {
    super(options)

    // overwrite and make it a specific type of task
    this.schedule = options.schedule
  }

  display(signaleObj: SignaleLogConfig) {
    const prettyTime = prettyToday(this.schedule)
    const color = this.isComplete ? grey.strikethrough : chalk.blue
    signaleObj.message = `${color(prettyTime)} ${signaleObj.message}`

    if (this.isComplete) success(signaleObj)
    else if (this.inProgress) wait(signaleObj)
    else custom(signaleObj)
  }

  sort(other: IBullet): number {
    // make no assumption if we're not comparing against an event
    // push the calendar event down
    // NOTE: EXPERIMENTAL
    if (!(other instanceof EventTask)) return 1

    // otherwise sort by timestamp ASC (meaning oldest event at the top)
    // if the current task is older, it will be negative, pushing it first as we want
    return this.schedule - other.schedule
  }
}
