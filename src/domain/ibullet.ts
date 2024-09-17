import fs from 'fs'
import childProcess from 'child_process'
import tmp from 'tmp'
import { formatDistance } from 'date-fns'
import { nanoid } from 'nanoid'
import { SignaleLogConfig } from '../interfaces/printer'
import { Maybe, UnixTimestamp } from '../types'

const MS_IN_DAY = 24 * 60 * 60 * 1000

export enum Priority {
  Normal = 1,
  Medium = 2,
  High = 3,
}

// since we load all properties as json and initialising task with it,
// all Item props need to be supported, albeit mostly optional
export interface IBulletOptions {
  id: number
  _uid?: string
  _createdAt?: UnixTimestamp
  description: string
  comment?: string
  isStarred?: boolean
  boards?: string[]
  tags?: string[]
  link?: string
  updatedAt?: UnixTimestamp
  duration?: number
  estimate?: number
  isComplete?: boolean
  inProgress?: boolean
  priority?: Priority
  repeat?: string
  _startedAt?: UnixTimestamp
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

  /** ----------------------------------------------------------------------------------
   * Methods
   */

  display: (signaleObj: SignaleLogConfig) => void

  age: () => number

  addTag: (tag: string) => void

  decodeComment: () => Maybe<string>

  writeCommentInEditor: (editor: string) => void

  writeComment: (content: string) => void

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

  // TODO: this would be just a lot easier to have 1 `writeComment` and open
  // the editor if no content is passed. But importing the config here creates
  // a circular dependency we need to fix first
  public writeCommentInEditor(editor: string) {
    const tmpFile = tmp.fileSync({ mode: 0o644, prefix: 'taskbook-', postfix: '.md' })

    let initContent = `# ID ${this.id} - ${this.description}

> _write content here..._
`
    if (this.link) initContent += `\n🔗 [Resource](${this.link})\n`

    if (this.comment)
      // initialise the file with the existing comment
      initContent = Buffer.from(this.comment as string, 'base64').toString('ascii')
    fs.writeFileSync(tmpFile.fd, initContent)

    childProcess.spawnSync(editor, [`${tmpFile.name}`], { stdio: 'inherit' })
    // TODO: handle child error
    const comment = fs.readFileSync(tmpFile.name, 'utf8').trim()

    this.writeComment(comment)
  }

  public writeComment(content: string) {
    const encoded = Buffer.from(content).toString('base64')

    this.comment = encoded
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
    const comment = this.decodeComment()
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
