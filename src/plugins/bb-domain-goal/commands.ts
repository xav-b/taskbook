import clipboardy from 'clipboardy'
import Taskbook from '../../use_cases/taskbook'
import { parseOptions } from '../../shared/parser'
import render from '../../interfaces/render'
import config from '../../config'
import Goal from './goal'

function create(board: Taskbook, desc: string[]) {
  const { description, priority, tags } = parseOptions(desc, {
    defaultBoard: config.local.defaultBoard,
  })
  const id = board._data.generateID()
  // we don't parse goals but instead assign it right away to the predefined
  // `goals` one.
  const boards = [`@${config.plugins.goals.board}`]

  const goal = new Goal({ id, description, boards, priority, tags })
  const { _data } = board

  _data.set(id, goal)
  board._save(_data)

  if (config.local.enableCopyID) clipboardy.writeSync(String(id))

  render.successCreate(goal)
}

function link(board: Taskbook, goalID: string, taskIDs: string[]) {
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
    const { tags } = _data.get(taskID)
    if (!tags.includes(goalTag)) tags.push(goalTag)
  })

  // FIXME: board.starItems(taskIDs) won't save it
  render.markStarred(taskIDs)

  board._save(_data)

  render.successMove(taskIDs.join(', '), [goalTag])
}

export default { create, link }
