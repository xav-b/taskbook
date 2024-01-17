import { Command } from 'commander'
import Taskbook from '../../use_cases/taskbook'
import { parseDuration } from '../../shared/parser'
import BulletBoardPlugin from '..'

import commands from './commands'

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
      .argument('schedule')
      .argument('estimate')
      .argument('<description...>')
      .action((schedule, estimate, description) => {
        const estimateMs = parseDuration(estimate)
        if (!estimateMs) throw new Error(`failed to parse estimate: ${estimate}`)

        // TODO: support `schedule` as a datetime, and trick the system of creation date
        // so by default will display today's events
        commands.create(board, schedule, description, estimateMs)
      })
  }
}
