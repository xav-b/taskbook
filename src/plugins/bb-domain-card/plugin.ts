import { Command } from 'commander'
import Taskbook from '../../use_cases/taskbook'
import BulletBoardPlugin from '..'

import commands from './commands'

export default class FlashcardPlugin extends BulletBoardPlugin {
  version = '0.1.2'

  register(program: Command, board: Taskbook) {
    program
      .command('card')
      .description('Create a flashcard')
      .argument('<front...>')
      .option('-l, --link [link]', 'Bind a clickable link to the task')
      .action((front, options) => {
        commands.createCard(board, front, options.link)
      })
  }
}
