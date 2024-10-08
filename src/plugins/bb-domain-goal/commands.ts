import clipboardy from 'clipboardy'
import Taskbook from '../../use_cases/taskbook'
import { parseOptions } from '../../shared/parser'
import render from '../../interfaces/render'
import config from '../../config'
import Goal from './goal'

const goalsBoard = config.plugins?.goals?.board || 'goals'

function create(board: Taskbook, desc: string[]) {
  const { description, priority, tags } = parseOptions(desc, {
    defaultBoard: config.local.defaultBoard,
  })
  const id = board.office.desk.generateID()
  // we don't parse goals but instead assign it right away to the predefined
  // `goals` one.
  const boards = [`@${goalsBoard}`]

  const goal = new Goal({ id, description, boards, priority, tags })

  board.office.desk.set(goal, id)
  board.office.desk.flush()

  if (config.local.enableCopyID) clipboardy.writeSync(String(id))

  render.successCreate(goal)
}

function link(board: Taskbook, goalID: string, taskIDs: string[]) {
  const { desk } = board.office

  // TODO: verify that goal exists
  // camel-case it
  const goalTag = `+${desk.get(goalID).description.replace(' ', '')}`
  // alternative: const goalBoard = `@goal-${goalID}`

  taskIDs.forEach((taskID: string) => {
    // we use `star` to indicate a task is linked to a goal
    const item = desk.get(taskID)
    item.isStarred = true

    // and the actual linkage to a goal happens through a tag. As a remidner,
    // tags are used as immutable boards. We don't expect that task to ever
    // depart from the goal in its lifetime, but we still enjoy the boards/'
    // benefits, like listing goal's tasks together with a simple `tb list
    // <mygoal>`
    if (!item.tags.includes(goalTag)) item.tags.push(goalTag)

    desk.set(item, item.id)
  })

  // FIXME: board.starItems(taskIDs) won't save it
  render.markStarred(taskIDs)

  desk.flush()

  render.successMove(taskIDs.join(', '), [goalTag])
}

export default { create, link }
