import clipboardy from 'clipboardy'
import Taskbook from '../../use_cases/taskbook'
import { parseOptions } from '../../shared/parser'
import render from '../../interfaces/render'
import config from '../../config'
import Goal from './goal'

const goalsBoard = config.plugins?.goals?.board || 'goals'

async function create(board: Taskbook, desc: string[]) {
  const { description, priority, tags } = parseOptions(desc, {
    defaultBoard: config.local.defaultBoard,
  })
  const id = board.office.desk.generateID()
  // we don't parse goals but instead assign it right away to the predefined
  // `goals` one.
  const boards = [`@${goalsBoard}`]

  const goal = new Goal({ id, description, boards, priority, tags })

  await board.office.desk.set(goal, id)

  if (config.local.enableCopyID) clipboardy.writeSync(String(id))

  render.successCreate(goal)
}

async function link(board: Taskbook, goalID: string, taskIDs: string[]) {
  const { desk } = board.office

  // TODO: verify that goal exists
  // camel-case it
  const goal = await desk.get(goalID)
  if (goal === null) throw new Error(`enabled to find goal #${goalID}`)

  const goalTag = `+${goal.description.replace(' ', '')}`
  // NOTE: alternative: const goalBoard = `@goal-${goalID}`

  const tasks = await desk.getMulti(taskIDs)
  for (const item of tasks) {
    // FIXME: `getMulti` design dosn't tell us which one was not found
    if (item === null) throw new Error(`there was an invalid item: ${taskIDs}`)

    // we use `star` to indicate a task is linked to a goal
    item.isStarred = true

    // and the actual linkage to a goal happens through a tag. As a remidner,
    // tags are used as immutable boards. We don't expect that task to ever
    // depart from the goal in its lifetime, but we still enjoy the boards/'
    // benefits, like listing goal's tasks together with a simple `tb list
    // <mygoal>`
    if (!item.tags.includes(goalTag)) item.tags.push(goalTag)

    await desk.set(item, item.id)
  }

  // FIXME: board.starItems(taskIDs) won't save it
  render.markStarred(taskIDs)

  render.successMove(taskIDs.join(', '), [goalTag])
}

export default { create, link }
