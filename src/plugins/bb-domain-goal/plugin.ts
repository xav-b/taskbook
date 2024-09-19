import { Command } from 'commander'
import Taskbook from '../../use_cases/taskbook'
import BulletBoardPlugin from '..'

import commands from './commands'

export default class GoalPlugin extends BulletBoardPlugin {
  register(program: Command, board: Taskbook) {
    program
      .command('goal')
      .alias('g')
      .description('Create a new goal')
      .argument('<description...>')
      .action(async (description) => await commands.create(board, description))

    program
      .command('toward')
      .description('Link tasks to a goal')
      .argument('goal')
      .argument('<tasks...>')
      .action(async (goal, tasks) => await commands.link(board, goal, tasks))
  }
}
