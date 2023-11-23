import { nanoid } from 'nanoid'
import { Maybe, UnixTimestamp } from '../types'

// since we load all properties as json and initialising task with it,
// all Item props need to be supported, albeit mostl options
export interface ItemProperties {
  _id: number
  _uid?: string
  description: string
  comment?: string
  isStarred?: boolean
  boards?: string[]
  tags?: string[]
  updatedAt?: UnixTimestamp
  _createdAt?: UnixTimestamp
}

const MS_IN_DAY = 24 * 60 * 60 * 1000

export default abstract class Item {
  // `id` is not read-only as saving to archive allows to swap the "normal"
  // storage id for the archive one. Not a great practice but this requires to
  // rething how ids are managed between different kind of storage.
  // (restore management of ids is probaably related)
  _id: number
  protected _uid: string
  readonly _createdAt: UnixTimestamp
  abstract _type: string
  abstract isTask: boolean

  updatedAt: UnixTimestamp
  description: string
  comment: Maybe<string>
  isStarred: boolean
  boards: string[]
  tags: string[]

  constructor(options: ItemProperties) {
    const now = new Date()

    // unique, immutable item id
    this._uid = options._uid || nanoid()
    // convenient, transient id for UX
    // TODO: make it public now
    this._id = options._id

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
  }

  age(): number {
    const birthday = this._createdAt
    return Math.round(Math.abs((birthday - Date.now()) / MS_IN_DAY))
  }

  public toJSON(): Record<string, any> {
    const jsonObj: Record<string, any> = {}

    const props = Object.getOwnPropertyNames(this)
    props.forEach((property: string) => {
      jsonObj[property] = this[property as keyof typeof this]
    })

    return jsonObj
  }
}
