const now = new Date()

class Item {
  constructor(options = {}) {
    this._id = options.id
    this._type = 'task'
    this._date = now.toDateString()
    this._timestamp = now.getTime()

    this.description = options.description
    // comments are inserted afterward with a specific command
    this.comment = null
    this.isStarred = options.isStarred || false
    this.boards = options.boards || []
    this.tags = options.tags || []
  }
}

module.exports = Item
