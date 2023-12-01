import { Command } from 'commander'
import clipboardy from 'clipboardy'

import Task, { TaskProperties } from './task'
import Printer, { SignaleLogConfig, wait, success } from '../interfaces/printer'
import Taskbook from '../use_cases/taskbook'
import { parseOptions } from '../shared/parser'
import render from '../interfaces/render'

const { custom } = Printer('🎯 goal')

export default class Goal extends Task {
  _type = 'goal'

  constructor(options: TaskProperties) {
    super(options)
  }

  display(signaleObj: SignaleLogConfig) {
    // NOTE: this looks like exactly what the default implementation should be
    if (this.isComplete) success(signaleObj)
    else if (this.inProgress) wait(signaleObj)
    else custom(signaleObj)
  }
}

function createGoal(board: Taskbook, desc: string[]) {
  const { description, priority, tags } = parseOptions(desc, {
    defaultBoard: board._configuration.defaultBoard,
  })
  const id = board._data.generateID()
  // we don't parse goals but instead assign it right away to the predefined `goals` one.
  const boards = [`@${board._configuration.goalsBoard}`]

  const goal = new Goal({ id, description, boards, priority, tags })
  const { _data } = board

  _data.set(id, goal)
  board._save(_data)

  if (board._configuration.enableCopyID) clipboardy.writeSync(String(id))

  render.successCreate(goal)
}

function linkToGoal(board: Taskbook, goalID: string, taskIDs: string[]) {
  const { _data } = board
  // TODO: verify that goal exists
  // camel-case it
  const goalTag = `+${_data.get(goalID).description.replace(' ', '')}`
  // alternative: const goalBoard = `@goal-${goalID}`

  taskIDs.forEach((taskID: string) => {
    // we use `star` to indicate a task is linked to a goal
    _data.get(taskID).isStarred = true

    // and the actual linkage to a goal happens through a tag. As a remidner,
    // tags are used as immutable boards. We don't expect that task to ever
    // depart from the goal in its lifetime, but we still enjoy the boards/'
    // benefits, like listing goal's tasks together with a simple `tb list
    // <mygoal>`
    const tags = _data.get(taskID).tags
    if (!tags.includes(goalTag)) tags.push(goalTag)
  })

  // we use a star to indicate this is linked to a goal
  // FIXME: board.starItems(taskIDs) won't save it
  render.markStarred(taskIDs)

  board._save(_data)

  render.successMove(taskIDs.join(', '), [goalTag])
}

export function commands(program: Command, board: Taskbook) {
  program
    .command('goal')
    .alias('g')
    .description('Create a new goal')
    .argument('<description...>')
    .action((description) => createGoal(board, description))

  program
    .command('toward')
    .description('Link tasks to a goal')
    .argument('goal')
    .argument('<tasks...>')
    .action((goal, tasks) => linkToGoal(board, goal, tasks))
}
