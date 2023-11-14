const Item = require('./item')
const { parseDuration } = require('../shared/utils')

class Task extends Item {
  constructor(options = {}) {
    super(options)

    this._isTask = true
    this._type = 'task'
    // also track how long it took to complete it
    this._startedAt = null

    // TODO: `null` is a better representation of not available
    this.duration = 0
    this.estimate = parseDuration(options.estimate)
    this.isComplete = options.isComplete || false
    this.inProgress = options.inProgress || false
    this.isStarred = options.isStarred || false
    this.priority = options.priority || 1
    this.repeat = options.priority || null
  }
}

module.exports = Task
