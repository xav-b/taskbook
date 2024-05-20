import clipboardy from 'clipboardy'

import Taskbook from '../../use_cases/taskbook'
import { parseOptions } from '../../shared/parser'
import render from '../../interfaces/render'
import FlashcardTask from './card'

const debug = require('debug')('tb:plugin:card:commands')

/**
 * Creating a flashcard is completely similar to creating a task. In fact the
 * plugin exists for only 2 reasons: typing the card so they can be
 * identified, and work out the review process.
 */
function createCard(board: Taskbook, front: string[], link?: string) {
  const { _data } = board

  // const boards = [`@${board._configuration.cardBoard}`]
  const { description, tags, boards } = parseOptions(front, {
    // automatically push to the global board for all flashcards
    defaultBoard: board._configuration.defaultBoard,
  })

  // FIXME: boards.push(`@${board._configuration.cardBoard}`)
  // TODO: use config
  const deckBoards = boards.map((b: string) => `@deck.${b.replace('@', '')}`)
  // an easy way to list them all by using `tb list srr`
  tags.push('+srr')

  const id = _data.generateID()

  debug(`initialising flashcard ${id}: ${boards}`)
  const flashcard = new FlashcardTask({
    id,
    description,
    boards: deckBoards,
    tags,
  })

  _data.set(id, flashcard)

  board._save()

  render.successCreate(flashcard)

  // TODO: it's a bit silly to re-load and re-save for the comment but this is
  // in order to leverage the current implementation of `board.comment()`. That
  // method should offer to simply manage the creation of the comment, so we
  // can save it in one go.
  board.comment(String(id))

  if (board._configuration.enableCopyID) clipboardy.writeSync(String(id))
}

export default { createCard }
