import clipboardy from 'clipboardy'
const debug = require('debug')('tb:plugin:event:commands')

import Taskbook from '../../use_cases/taskbook'
import { UnixTimestamp } from '../../types'
import { parseOptions } from '../../shared/parser'
import render from '../../interfaces/render'
import EventTask from './event'
import gcal from './gcal'

const DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000

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

// TODO: also capture the calendar description and enable comment and `--notebook`
// pending implementation of non-vim input
function upsert(
  board: Taskbook,
  schedule: UnixTimestamp,
  desc: string[],
  estimate: number,
  eventID?: string
) {
  const { _data } = board

  const boards = [`@${board._configuration.eventBoard}`]
  const { description, tags } = parseOptions(desc, {
    defaultBoard: board._configuration.defaultBoard,
  })

  const existing = eventID !== undefined ? board._data.uget(eventID) : null
  // if the item already exists, we will attempt to overwrite everything with the data fetched
  const id = existing?.id ?? _data.generateID()

  debug(`initialising event ${id}`)
  const event = new EventTask({ id, _uid: eventID, description, boards, tags, schedule, estimate })

  if (existing) debug(`updating event ${id} (${existing._uid})`)
  else debug(`creating event ${id}`, event)
  _data.set(id, event)
  board._save()

  if (board._configuration.enableCopyID) clipboardy.writeSync(String(id))

  if (existing) render.successEdit(String(id))
  else render.successCreate(event)
}

// FIXME: don't recreate events if running twice
async function syncGCal(board: Taskbook) {
  const auth = await gcal.authorize()
  const events = await todayEvents(auth)

  // now we want to:
  // - create new events
  // - update existing ones
  // - delete events that got removed from calendar

  // first pull existing events we have
  // TODO: `@calendar` from config or constants
  const todayExistingEvents = Object.values(board._data.all()).filter((each) =>
    each.boards.includes('@calendar')
  )

  // anything that's no longer on the calendar?
  const idsToDelete: string[] = []
  todayExistingEvents.forEach((each) => {
    if (events.find((ge) => ge?.id === each._uid) === undefined) {
      debug(`deleting event ${each._uid}`)
      idsToDelete.push(String(each.id))
    }
  })
  if (idsToDelete.length > 0) {
    board.deleteItems(idsToDelete)
    // if there are no further events to process, this is our only chance to
    // commit the deletions
    if (events.length === 0) board._save()
  }

  events.forEach((calEvent) => {
    const schedule = calEvent?.startTime.getTime()
    if (schedule === undefined) throw new Error(`invalid event start time: ${calEvent?.startTime}`)

    const desc: string[] = calEvent?.title?.split(' ') || []

    upsert(
      board,
      schedule,
      desc,
      calEvent?.duration || DEFAULT_EVENT_DURATION_MS,
      calEvent?.id || undefined
    )
  })
}

export default { upsert, syncGCal }
