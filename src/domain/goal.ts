import Task, { TaskProperties } from './task'

export default class Goal extends Task {
  readonly _type: string

  constructor(options: TaskProperties) {
    super(options)

    this._type = 'goal'
  }
}
