import { Command } from 'commander'
import Taskbook from '../../use_cases/taskbook'
import { parseDuration } from '../../shared/parser'
import { today, prettyTzOffset } from './utils'
import BulletBoardPlugin from '..'

import commands from './commands'

/**
 * Get today timezone aware date object out of HH:MM.
 */
function parseScheduleTime(time: string): Date {
  return new Date(`${today()}T${time}:00${prettyTzOffset()}`)
}

export default class EventPlugin extends BulletBoardPlugin {
  // mapping set here will be accessible under `board.config.event.{key}`
  // the value specified is the default
  config = {
    eventBoard: 'calendar',
  }

  register(program: Command, board: Taskbook) {
    // add event commands to bullet board cli
    // NOTE: support duration as a markup? Like `last:30m`
    program
      .command('event')
      .alias('E')
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

    program.command('event.sync').action(async () => await commands.syncGCal(board))
  }
}
