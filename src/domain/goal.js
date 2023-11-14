const Task = require('./task')

class Goal extends Task {
  constructor(options = {}) {
    super(options)

    this._type = 'goal'
  }
}

module.exports = Goal
