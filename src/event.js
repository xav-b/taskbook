const Task = require('./task')

/**
 * Events are tasks to accomplish at the end.
 * They may have priorities, and they can be done, in progress, etc...
 */
class EventTask extends Task {
  constructor(options = {}) {
    super(options)
    this._type = 'event'

    this.schedule = options.schedule
    this.duration = options.duration || null
    this.repeat = options.priority || null
  }
}

module.exports = EventTask
