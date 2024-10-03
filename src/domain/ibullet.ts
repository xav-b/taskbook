import { formatDistance } from 'date-fns'
import { nanoid } from 'nanoid'
import { SignaleLogConfig } from '../interfaces/printer'
import { Maybe, UnixTimestamp } from '../types'
import editors from '../modules/editors'
import Priority from './priority'
import config from '../config'

const MS_IN_DAY = 24 * 60 * 60 * 1000
// NOTE: this would make more sense to have it as a property of iBullet since
// it would achieve the same, but avoid work in global namespace, and offer to
// use it when having an item instance. But this breaks `structuredClone` used
// for task creation, and in general the flat data structure of the IBullet
// object.
const editor = editors[config.local.editor]

// since we load all properties as json and initialising task with it,
// all Item props need to be supported, albeit mostly optional
export interface IBulletOptions {
  // TODO: remap `id` ot the `uid` and `_uid` to `ctxId` (get it closer to db)
  id: number
  _type?: string
  _uid?: string
  _createdAt?: UnixTimestamp
  description: string
  comment?: string | null
  isStarred?: boolean | null
  boards?: string[] | null
  tags?: string[] | null
  link?: string | null
  updatedAt?: UnixTimestamp | null
  duration?: number | null
  estimate?: number | null
  isComplete?: boolean | null
  inProgress?: boolean | null
  priority?: Priority
  repeat?: string | null
  _startedAt?: UnixTimestamp | null
  schedule?: UnixTimestamp | null
}

/**
 * IBullet is the interface contract that all entities need to comply with.
 * This allows the code to work with one type and always assume a property or
 * method is defined. And that's the implemted classes to customise the
 * behaviour. In that regard, it tries to replicate the code arch of golang
 * interfaces.
 */
export default interface IBullet {
  /** ----------------------------------------------------------------------------------
   * Properties
   */

  // General properties

  // `id` is not read-only as saving to archive allows to swap the "normal"
  // storage id for the archive one. Not a great practice but this requires to
  // rething how ids are managed between different kind of storage.
  // (restore management of ids is probaably related)
  id: number

  _uid: string

  _createdAt: UnixTimestamp

  _type: string

  isTask: boolean

  updatedAt: UnixTimestamp

  description: string

  comment: Maybe<string>

  isStarred: boolean

  boards: string[]

  tags: string[]

  link: string | null

  // Task-specific properties

  _startedAt: Maybe<number>

  duration: Maybe<number>

  estimate: Maybe<number>

  isComplete: boolean

  inProgress: boolean

  priority: Priority

  repeat: Maybe<string>

  schedule: Maybe<UnixTimestamp>

  /** ----------------------------------------------------------------------------------
   * Methods
   */

  display: (signaleObj: SignaleLogConfig) => void

  age: () => number

  addTag: (tag: string) => void

  decodeComment: () => Maybe<string>

  writeComment: (content?: string) => void

  toJSON: () => Record<string, any>

  toMarkdown: () => void

  setEstimate: (estimate: Maybe<number>, withSize: boolean) => void

  begin: () => void

  check: (duration: Maybe<number>, tags?: string[]) => void

  uncheck: () => void

  sort: (other: IBullet) => number
}

/**
 * Implement the basic set of methods that all implementations will share.
 * Since it implements a valid `IBullet`, subsequent extension will also comply
 * with it, without having to re-declare everything, in particular when
 * defaults make sense or it's not usesd at all.
 * This can backfilre though, as you end up with a bunch of property not
 * necessarily related to what your final implementation need.
 */
export abstract class BasicBullet implements IBullet {
  id: number

  _uid: string

  _createdAt: UnixTimestamp

  _type: string

  isTask: boolean

  updatedAt: UnixTimestamp

  description: string

  comment: Maybe<string>

  isStarred: boolean

  boards: string[]

  tags: string[]

  link: string | null

  // Task-specific properties

  _startedAt: Maybe<number>

  duration: Maybe<number>

  estimate: Maybe<number>

  isComplete: boolean

  inProgress: boolean

  priority: Priority

  repeat: Maybe<string>

  schedule: Maybe<UnixTimestamp>

  constructor(options: IBulletOptions) {
    const now = new Date()

    // unique, immutable item id
    this._uid = options._uid || nanoid()
    // convenient, transient id for UX
    this.id = options.id

    this.isTask = false // not yet, at least
    this._type = 'raw'

    // NOTE: using UNIX ms for those dates, and subsequently for durations, is
    // a useless precision. Minute granularity is probably what's needed from a
    // domain perspective, or seconds if we want to strike a balance between
    // practicality and epoch. But as I looked into fixing this, it brings no
    // visibile benefit to the user, and marginally reafactor code (all the
    // spared `* 60 * 1000` are just moved to `Math.ceil(now.getTime() /
    // 1000)`). And so status quo.
    this._createdAt = options._createdAt || now.getTime()
    this.updatedAt = options.updatedAt || now.getTime()

    this.description = options.description
    // NOTE: we could have it a protected `_comment` and expose a `comment()`
    // method that does the base64 decode
    this.comment = options.comment || null
    this.isStarred = options.isStarred || false
    this.boards = options.boards || []
    this.tags = options.tags || []
    this.link = options.link || null

    this._startedAt = options._startedAt || null

    this.duration = options.duration || null
    this.isComplete = options.isComplete || false
    this.inProgress = options.inProgress || false
    this.isStarred = options.isStarred || false
    this.priority = options.priority || 1
    // we store and read the raw user repeat. The parsing structure looks
    // pretty complicated and so we leave it to the actual use cases to do
    // their parsing.
    this.repeat = options.repeat || null
    this.estimate = options.estimate || null
    this.schedule = options.schedule || null
  }

  public age(): number {
    const birthday = this._createdAt
    return Math.round(Math.abs((birthday - Date.now()) / MS_IN_DAY))
  }

  /**
   * Simple wrapper to avoid duplicates
   */
  public addTag(tag: string) {
    if (!this.tags.includes(tag)) this.tags.push(tag)
  }

  decodeComment(): Maybe<string> {
    if (!this.comment) return null

    return Buffer.from(this.comment, 'base64').toString('ascii')
  }

  // TODO: now we can delete that
  public writeComment(content?: string) {
    this.comment = editor.write(this, content)
  }

  public toJSON(): Record<string, any> {
    const jsonObj: Record<string, any> = {}

    const props = Object.getOwnPropertyNames(this)
    props.forEach((property: string) => {
      jsonObj[property] = this[property as keyof typeof this]
    })

    return jsonObj
  }

  // default to sort by ID ASC (which should be newest first)
  public sort(other: IBullet) {
    return this.id - other.id
  }

  /**
   * Display task details in markdown format.
   */
  public toMarkdown() {
    const comment = editor.read(this)
    const ago = formatDistance(new Date(this._createdAt), new Date(), { addSuffix: true })
    // saving an interesting past feature, pulling tasks from the comments
    // const subtasksDone = (decoded.match(/\[x\]/g) || []).length
    // const subtasksTodo = (decoded.match(/\[\s\]/g) || []).length

    console.log(`\n## ${this.id} - ${this.description}\n`)

    console.log(`
| Meta | Value |
| ---- | ----- |
| UID | ${this._uid} |
| Created | ${ago} |
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

  public setEstimate(estimate: Maybe<number>, withSize: boolean): void {
    throw new Error('not implemented')
  }

  public begin(): void {
    throw new Error('not implemented')
  }

  public check(duration: Maybe<number> = null, tags?: string[]): void {
    throw new Error('not implemented')
  }

  public uncheck(): void {
    throw new Error('not implemented')
  }

  public display(signaleObj: SignaleLogConfig): void {
    throw new Error('not implemented')
  }
}
