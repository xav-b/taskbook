import clipboardy from 'clipboardy'

import Taskbook from '../../use_cases/taskbook'
import { parseOptions } from '../../shared/parser'
import render from '../../interfaces/render'
import Logger from '../../shared/logger'
import EventTask from './event'
import gcal from './gcal'

const log = Logger()

async function todayEvents(auth: any) {
  // get today events
  const todayDate = new Date().toISOString().replace(/T.*/, '')
  const timeMin = `${todayDate}T00:00:00+08:00`
  const timeMax = `${todayDate}T23:59:59+08:00`

  return await gcal.listEvents(auth, {
    timeMin,
    timeMax,
  })
}

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

// FIXME: don't recreate events if running twice
async function syncGCal(board: Taskbook) {
  const auth = await gcal.authorize()
  const events = await todayEvents(auth)

  // TODO: should not be, implement proper typing
  if (events === undefined) throw new Error('failed to retrieve events')

  events.forEach((calEvent) => {
    const startH = calEvent?.startTime.getHours() || 0
    const startHStr = startH < 10 ? `0${startH}` : String(startH)

    const startM = calEvent?.startTime.getMinutes() || 0
    const startMStr = startM < 10 ? `0${startM}` : String(startM)

    const xm = startH >= 12 ? 'pm' : 'am'

    const schedule = `${startHStr}:${startMStr}${xm}`
    const desc: string[] = calEvent?.title?.split(' ') || []

    create(board, schedule, desc, calEvent?.duration || 30 * 60 * 1000 /* default to 30min */)
    // console.log(schedule, desc, calEvent?.duration || 30 * 60 * 1000 /* default to 30min */)
  })
}

export default { create, syncGCal }
