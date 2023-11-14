const Task = require('./task')

/**
 * Events are tasks to accomplish at the end.
 * They may have priorities, and they can be done, in progress, etc...
 */
class EventTask extends Task {
  constructor(options = {}) {
    super(options)

    // overwrite and make it a specific type of task
    this._type = 'event'

    this.schedule = options.schedule
    this.estimate = options.estimate * 60 * 1000
  }
}

module.exports = EventTask
