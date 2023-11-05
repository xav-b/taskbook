const Item = require('./item')

class Task extends Item {
  constructor(options = {}) {
    super(options)

    this._isTask = true
    this._type = 'task'
    // also track how long it took to complete it
    this._duration = 0
    this._startedAt = null

    this.isComplete = options.isComplete || false
    this.inProgress = options.inProgress || false
    this.isStarred = options.isStarred || false
    this.priority = options.priority || 1
    this.repeat = options.priority || null
  }
}

module.exports = Task
