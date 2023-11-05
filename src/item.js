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
