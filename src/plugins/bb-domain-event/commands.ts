import clipboardy from 'clipboardy'

import Taskbook from '../../use_cases/taskbook'
import { UnixTimestamp } from '../../types'
import { parseOptions } from '../../shared/parser'
import render from '../../interfaces/render'
import config from '../../config'
import Logger from '../../shared/logger'
import EventTask from './event'
import gcal from './gcal'

const log = Logger('plugin.event')

const DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000
const calendarBoard = config.plugins?.calendar?.board || 'calendar'

async function todayEvents(auth: any) {
  // get today events
  // Canada locale string format is what we want: YYYY-MM-DD
  const todayDate = new Date().toLocaleDateString('en-CA')
  const timeMin = `${todayDate}T00:00:00+08:00`
  const timeMax = `${todayDate}T23:59:59+08:00`

  log.debug(`searching events: ${timeMin} -> ${timeMax}`)
  return gcal.listEvents(auth, {
    timeMin,
    timeMax,
  })
}

// TODO: also capture the calendar description and enable comment and `--notebook`
// pending implementation of non-vim input
async function upsert(
  board: Taskbook,
  schedule: UnixTimestamp,
  desc: string[],
  estimate: number,
  eventID?: string
) {
  const boards = [`@${calendarBoard}`]
  const { description, tags } = parseOptions(desc, {
    defaultBoard: config.local.defaultBoard,
  })

  const existing = eventID !== undefined ? board.office.desk.uget(eventID) : null
  // if the item already exists, we will attempt to overwrite everything with
  // the data fetched
  const id = existing?.id ?? board.office.desk.generateID()

  log.debug(`initialising event ${id}`)
  const event = new EventTask({
    id,
    _uid: eventID,
    description,
    boards,
    tags,
    schedule,
    estimate,
  })

  if (existing) log.info(`updating event ${id} (${existing._uid})`)
  else log.info(`creating event ${id}`, event)
  await board.office.desk.set(event, id)

  if (config.local.enableCopyID) clipboardy.writeSync(String(id))

  if (existing) render.successEdit(String(id))
  else render.successCreate(event, true)
}

async function syncGCal(board: Taskbook, name?: string | null) {
  const auth = await gcal.authorize(name)
  const events = await todayEvents(auth)

  if (events.length > 0) board.office.desk.loadCache()
  else return

  // now we want to:
  // - create new events
  // - update existing ones
  // - delete events that got removed from calendar

  // first pull existing events we have
  const allItems = board.office.desk.all()
  const todayExistingEvents = Object.values(allItems).filter((each) =>
    each.boards.includes(`@${config.local.defaultBoard}`)
  )

  // anything that's no longer on the calendar?
  const idsToDelete: string[] = []
  todayExistingEvents.forEach((each) => {
    if (events.find((ge) => ge?.id === each._uid) === undefined) {
      log.warn(`unable to find event ${each._uid} - deleting`)
      idsToDelete.push(String(each.id))
    }
  })

  if (idsToDelete.length > 0) await board.deleteItems(idsToDelete)

  for (const calEvent of events) {
    const schedule = calEvent?.startTime.getTime()
    if (schedule === undefined) throw new Error(`invalid event start time: ${calEvent?.startTime}`)

    const desc: string[] = calEvent?.title?.split(' ') || ['Untitled']
    const systemTags = [`cal.${name}`].map((each: string) => `+${each}`)
    // NOTE: we could also pass additional tags from CLI, like `+pro`

    await upsert(
      board,
      schedule,
      desc.concat(systemTags),
      calEvent?.duration || DEFAULT_EVENT_DURATION_MS,
      calEvent?.id || undefined
    )
  }
}

export default { upsert, syncGCal }
