import { formatDistance } from 'date-fns'
import IBullet, { BasicBullet, IBulletOptions } from './ibullet'
import Priority from './priority'
import { Maybe, UnixTimestamp } from '../types'
import { msToMinutes } from '../shared/utils'
import { SignaleLogConfig, wait, success, pending } from '../interfaces/printer'
import config from '../config'

function toSize(estimate: UnixTimestamp) {
  const friendly = estimate / 60 / 1000

  if (friendly < 5) return 'xs'
  if (friendly < 15) return 's'
  if (friendly < 1 * 60) return 'm'
  if (friendly < 5 * 60) return 'l'

  return 'xl'
}

export default class Task extends BasicBullet {
  _type = 'task'

  isTask = true

  constructor(options: IBulletOptions) {
    // items can usually be created either because they are new, or because we
    // parsed and loaded existing items from storage, and they are all
    // re-initialised. This is detected by checking _uid, which doesn't exist
    // when creating a new instance, but has been generated once stored. An
    // alternative could be to offer 2 different consutructors, especially if
    // custom logic grows. `estimate` is a good example, it is stored and
    // re-passed at init as ms. But we otherwise want to be able to receive
    // human-friendly values, and the current approach will be a problem.
    const isNew = options._uid === undefined

    super(options)

    this.setEstimate(options.estimate || null, isNew && config.local.tshirtSizes)
  }

  public setEstimate(estimate: Maybe<number>, withSize: boolean) {
    // it's ok to set it to null - we don't have to know or we can even cancel it
    this.estimate = estimate

    // automatically tag with size shirt
    if (estimate && withSize) {
      const size = toSize(estimate)
      this.addTag(`+${size}`)
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
    if (duration) this.duration = duration
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

  // Sort by task priority
  public sort(other: IBullet) {
    // TODO: make that configurable
    const orderNull = -1
    const orderCompleted = -1

    // we want to have top priorities first, down to lowest so here the highest
    // priority should come as "lower" than the lowest ones
    // TODO: `isTask` could be generalised by just checking if the item has a
    // priority or not, it doesn't have to be a task, a goal could work out too,
    // for example.
    if (this.isTask && other.isTask) {
      if (this.isComplete && other.isComplete) return 0
      if (this.isComplete) return -orderNull
      if (other.isComplete) return orderNull

      return other.priority - this.priority
    }
    // if we are here, one of the 2 items is not a task. The behaviour we want is
    // to a) not affect the sorting of tasks with priorities, and b) push
    // downward/upward (depending on flag)
    if (this.isTask) return orderCompleted
    if (other.isTask) return -orderCompleted

    // none of the items are a task, stand still
    return 0
  }

  /**
   * Display task details in markdown format.
   * NOTE: too bad we have to re-implement item.toMarkdown() just to add
   * `priority` and `estimate` meta keys
   */
  toMarkdown() {
    const comment = this.decodeComment()
    const ago = formatDistance(new Date(this._createdAt * 1000), new Date(), { addSuffix: true })
    // saving an interesting past feature, pulling tasks from the comments
    // const subtasksDone = (decoded.match(/\[x\]/g) || []).length
    // const subtasksTodo = (decoded.match(/\[\s\]/g) || []).length

    console.log(`\n## ${this.id} - ${this.description}\n`)

    console.log(`
| Meta | Value |
| ---- | ----- |
| UID | ${this._uid} |
| Type | ${this._type} |
| Created | ${ago} |
| Priority | ${Priority[this.priority]} |
| Estimate | ${msToMinutes(this.estimate)} |
`)

    if (this.comment) {
      console.log(`\n---\n`)
      console.log(comment)
    }

    console.log('\n---\n')
    if (this.tags.length > 0) console.log(`> **tags**:   \`${this.tags.join('` • `')}\``)
    if (this.boards.length > 0) console.log(`> **boards**: \`${this.boards.join('` • `')}\``)
    if (this.link) console.log(`> [Resource](${this.link})`)
    console.log()
  }
}
