import { Command } from 'commander'
import Taskbook from '../../use_cases/taskbook'
import render from '../../interfaces/render'
import IBullet from '../../domain/ibullet'
import { parseDuration } from '../../shared/parser'
import config from '../../config'
import { parseScheduleTime } from './utils'
import EventTask from './event'
import BulletBoardPlugin from '..'
import commands from './commands'

const debug = require('debug')('tb:plugin:event:plugin')

/**
 * Mark as done all past events, so you don't have to.
 */
function garbageCollect(events: EventTask[]): IBullet[] {
  const checked: IBullet[] = []
  const now = new Date().getTime()

  events.forEach((each: EventTask) => {
    if (each.schedule < now && !each.isComplete) {
      each.check(null, ['+gc'])
      checked.push(each)
    }
    // TODO: detect in progress
  })

  return checked
}

function findEvents(board: Taskbook): EventTask[] {
  const events: EventTask[] = []
  Object.values(board._data.all()).forEach((item: IBullet) => {
    if (item._type === 'event') events.push(item as EventTask)
  })

  return events
}

export default class EventPlugin extends BulletBoardPlugin {
  register(program: Command, board: Taskbook) {
    // add event commands to bullet board cli
    // NOTE: support duration as a markup? Like `last:30m`
    program
      .command('event')
      .description('Create event')
      .argument('time')
      .argument('estimate')
      .argument('<description...>')
      .action((time, estimate, description) => {
        const estimateMs = parseDuration(estimate)
        if (!estimateMs) throw new Error(`failed to parse estimate: ${estimate}`)

        const dt = parseScheduleTime(time)

        // TODO: support `schedule` as a datetime, and trick the system of creation date
        // so by default will display today's events
        commands.upsert(board, dt.getTime(), description, estimateMs)
      })

    program
      .command('event.sync')
      .option(
        '-c, --calendar [calendar]',
        'name the calendar credentials that will be saved',
        'default'
      )
      .action(async (opts) => commands.syncGCal(board, opts.calendar))

    // NOTE: is it the best place to "garbage collect"? This could be done at
    // `tb clear` too, meaning developing a way to hook on that event, which
    // might be a nice idea. But this will remain uncheck until it runs, while
    // here this will always be up to date, consenting a bit pf perf hit.
    if (config.plugins?.calendar?.gc) {
      debug('garbage collecting events')

      const events = findEvents(board)
      const checked = garbageCollect(events)
      if (checked.length > 0) {
        board._save()
        render.markComplete(checked)
      }
    }
  }
}
