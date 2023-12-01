import { Command } from 'commander'
import Taskbook from '../../use_cases/taskbook'
import BulletBoardPlugin from '..'

import commands from './commands'

export default class GoalPlugin extends BulletBoardPlugin {
  // mapping set here will be accessible under `board.config.event.{key}`
  // the value specified is the default
  config = {
    goalsBoard: 'goals',
  }

  register(program: Command, board: Taskbook) {
    program
      .command('goal')
      .alias('g')
      .description('Create a new goal')
      .argument('<description...>')
      .action((description) => commands.create(board, description))

    program
      .command('toward')
      .description('Link tasks to a goal')
      .argument('goal')
      .argument('<tasks...>')
      .action((goal, tasks) => commands.link(board, goal, tasks))
  }
}
