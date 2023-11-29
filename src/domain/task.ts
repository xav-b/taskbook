import Item, { ItemProperties } from './item'
import { Maybe, UnixTimestamp } from '../types'
import { SignaleLogConfig, wait, success, pending } from '../interfaces/printer'
import { parseDuration } from '../shared/parser'
import config from '../config'

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
  _startedAt?: UnixTimestamp
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

    const conf = config.get()

    // items can usually be created either because they are new, or because we
    // parsed and loaded existing items from storage, and they are all
    // re-initialised. This is detected by checking _uid, which doesn't exist
    // when creating a new instance, but has been generated once stored. An
    // alternative cool be to offer 2 different consutructors, especially if
    // custom logic grows. `estimate` is a good example, it is stored and
    // re-passed at init as ms. But we otherwise want to be able to receive
    // human-friendly values, and the current approach will be a problem.
    const isNew = options._uid === undefined

    this._type = 'task'
    this._startedAt = options._startedAt || null

    this.isTask = true
    this.duration = options.duration || null
    this.isComplete = options.isComplete || false
    this.inProgress = options.inProgress || false
    this.isStarred = options.isStarred || false
    this.priority = options.priority || 1

    this.estimate = options.estimate || null
    // automatically tag with size shirt
    if (options.estimate && isNew && conf.tshirtSizes) {
      const friendly = options.estimate / 60 / 1000
      if (friendly < 5) this.tags.push('+xs')
      else if (friendly < 15) this.tags.push('+s')
      else if (friendly < 1 * 60) this.tags.push('+m')
      else if (friendly < 5 * 60) this.tags.push('+l')
      else this.tags.push('+xl')
    }
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

  check(duration: Maybe<number> = null, tags?: string[]) {
    // idempotency
    if (this.isComplete) return

    const now = new Date()

    // last chance to add tags as we close up the task
    if (tags) this.tags.push(...tags)

    // best effort to read or infere task duration
    // 1. if it was given
    if (duration) this.duration = parseDuration(duration)
    // 2. If we used `tb begin`
    else if (this._startedAt) {
      // initial task has it duration `null` but we may also have worked on it
      // before, meaning this would be a number.
      if (this.duration === null) this.duration = 0

      this.duration += now.getTime() - this._startedAt
    }
    // 3. no clue so far, try to fallback on estimate, which could have been
    // omitted and therefor `null`. But that's fine, it's a good representation
    // of " i tried hard but i have no idea at this point"
    else this.duration = this.estimate

    this.isComplete = true
    this.inProgress = false
    this.updatedAt = now.getTime()
    // we don't reset _startedAt as there might be some interesting stages
    // analytics there (created -> started -> completed)
  }

  uncheck() {
    // idempotency
    if (!this.isComplete) return

    this.isComplete = false
    this.updatedAt = new Date().getTime()
  }

  display(signaleObj: SignaleLogConfig) {
    if (this.isComplete) success(signaleObj)
    else if (this.inProgress) wait(signaleObj)
    else pending(signaleObj)
  }
}
