const { nanoid } = require('nanoid')

const now = new Date()

class Item {
  constructor(options = {}) {
    // unique, immutable item id
    this._uid = nanoid()
    // convenient, transient id for UX
    // TODO: make it public now
    this._id = options.id

    // no assumption, meant to be replace by child implementations
    this._type = null

    // NOTE: using UNIX ms for those dates, and subsequently for durations, is
    // a useless precision. Minute granularity is probably what's needed from a
    // domain perspective, or seconds if we want to strike a balance between
    // practicality and epoch. But as I looked into fixing this, it brings no
    // visibile benefit to the user, and marginally reafactor code (all the
    // spared `* 60 * 1000` are just moved to `Math.ceil(now.getTime() /
    // 1000)`). And so status quo.
    this._createdAt = now.getTime()
    this._updatedAt = now.getTime()

    this.description = options.description
    // comments are inserted afterward with a specific command
    this.comment = null
    this.isStarred = options.isStarred || false
    this.boards = options.boards || []
    this.tags = options.tags || []
  }
}

module.exports = Item
