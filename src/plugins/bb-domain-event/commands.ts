import clipboardy from 'clipboardy'

import Taskbook from '../../use_cases/taskbook'
import { parseOptions } from '../../shared/parser'
import render from '../../interfaces/render'
import Logger from '../../shared/logger'
import EventTask from './event'

const log = Logger()

function create(board: Taskbook, schedule: string, desc: string[], estimate: number) {
  const { _data } = board

  const boards = [`@${board._configuration.eventBoard}`]
  const { description, tags } = parseOptions(desc, {
    defaultBoard: board._configuration.defaultBoard,
  })
  const id = _data.generateID()

  log.info(`creating new event note ${id}`)
  const event = new EventTask({ id, description, boards, tags, schedule, estimate })

  log.info(`updating new event note ${id}`, event)
  _data.set(id, event)

  board._save(_data)

  if (board._configuration.enableCopyID) clipboardy.writeSync(String(id))

  render.successCreate(event)
}

export default { create }
