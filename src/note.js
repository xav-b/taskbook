const Item = require('./item')

class Note extends Item {
  constructor(options = {}) {
    super(options)

    this._isTask = false
    this._type = 'note'
  }
}

module.exports = Note
