import Item, { ItemProperties } from './item'
import { Maybe } from '../types'
import { parseDuration } from '../shared/utils'

export enum TaskPriority {
  Normal = 1,
  Medium = 2,
  High = 3,
}

export interface TaskProperties extends ItemProperties {
  duration?: number
  estimate?: number
  isComplete?: boolean
  inProgress?: boolean
  priority?: TaskPriority
}

export default class Task extends Item {
  protected _startedAt: Maybe<number>
  _type: string
  duration: Maybe<number>
  estimate: Maybe<number>
  isTask: boolean
  isComplete: boolean
  inProgress: boolean
  priority: TaskPriority

  constructor(options: TaskProperties) {
    super(options)

    this._type = 'task'
    // also track how long it took to complete it
    this._startedAt = null

    this.isTask = true
    // TODO: `null` is a better representation of not available
    this.duration = 0
    this.estimate = parseDuration(options.estimate || null)
    this.isComplete = options.isComplete || false
    this.inProgress = options.inProgress || false
    this.isStarred = options.isStarred || false
    this.priority = options.priority || 1
  }

  begin() {
    const now = new Date()

    this.isComplete = false
    this.inProgress = !this.inProgress

    if (this.inProgress) {
      // record start time, no change on duration
      this._startedAt = now.getTime()
    } else {
      // update duration
      if (typeof this.duration === 'number' && typeof this._startedAt === 'number')
        this.duration += now.getTime() - this._startedAt
      // and pause the task
      this._startedAt = null
    }
  }

  check(duration: Maybe<number> = null) {
    // idempotency
    if (this.isComplete) return

    const now = new Date()

    this.isComplete = true
    this.inProgress = false
    this.updatedAt = now.getTime()
    this._startedAt = null

    if (duration) this.duration = parseDuration(duration)
    // TODO: handle `duration` to be `null` (replace by 0)
    else if (this._startedAt && typeof this.duration === 'number')
      this.duration += now.getTime() - this._startedAt
    // could be `null` too but that's the best we can do at this point
    else this.duration = this.estimate
  }

  uncheck() {
    // idempotency
    if (!this.isComplete) return

    this.isComplete = false
    this.updatedAt = new Date().getTime()
  }
  // -------------------------------------------------------------------------------------
}
