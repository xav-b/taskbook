import { formatDistance } from 'date-fns'
import { nanoid } from 'nanoid'
import { SignaleLogConfig } from '../interfaces/printer'
import { Maybe, UnixTimestamp } from '../types'

// since we load all properties as json and initialising task with it,
// all Item props need to be supported, albeit mostl options
export interface ItemProperties {
  id: number
  _uid?: string
  description: string
  comment?: string
  isStarred?: boolean
  boards?: string[]
  tags?: string[]
  link?: string
  updatedAt?: UnixTimestamp
  _createdAt?: UnixTimestamp
}

const MS_IN_DAY = 24 * 60 * 60 * 1000

export default abstract class Item {
  // `id` is not read-only as saving to archive allows to swap the "normal"
  // storage id for the archive one. Not a great practice but this requires to
  // rething how ids are managed between different kind of storage.
  // (restore management of ids is probaably related)
  id: number
  _uid: string
  protected _createdAt: UnixTimestamp
  static _type: string
  abstract isTask: boolean

  updatedAt: UnixTimestamp
  description: string
  comment: Maybe<string>
  isStarred: boolean
  boards: string[]
  tags: string[]
  link: string | null

  abstract display(signaleObj: SignaleLogConfig): void

  constructor(options: ItemProperties) {
    const now = new Date()

    // unique, immutable item id
    this._uid = options._uid || nanoid()
    // convenient, transient id for UX
    this.id = options.id

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
    // NOTE: we culd have it a protected `_comment` and expose a `comment()`
    // method that deos the base64 decode
    this.comment = options.comment || null
    this.isStarred = options.isStarred || false
    this.boards = options.boards || []
    this.tags = options.tags || []

    this.link = options.link || null
  }

  age(): number {
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

  public toJSON(): Record<string, any> {
    const jsonObj: Record<string, any> = {}

    const props = Object.getOwnPropertyNames(this)
    props.forEach((property: string) => {
      jsonObj[property] = this[property as keyof typeof this]
    })

    return jsonObj
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
}
