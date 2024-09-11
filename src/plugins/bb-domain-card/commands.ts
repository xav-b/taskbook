import clipboardy from 'clipboardy'

import Taskbook from '../../use_cases/taskbook'
import { parseOptions } from '../../shared/parser'
import render from '../../interfaces/render'
import config from '../../config'
import Logger from '../../shared/logger'
import FlashcardTask from './card'

const log = Logger('plugin.card')

const boardPrefix = config.plugins?.srr?.prefix || 'deck'
const commonTag = config.plugins?.srr?.tag || 'srr'

/**
 * Creating a flashcard is completely similar to creating a task. In fact the
 * plugin exists for only 2 reasons: typing the card so they can be
 * identified, and work out the review process.
 */
function createCard(board: Taskbook, front: string[], link?: string) {
  const { _data } = board

  const { description, tags, boards } = parseOptions(front, {
    // automatically push to the global board for all flashcards
    defaultBoard: config.local.defaultBoard,
  })

  // FIXME: boards.push(`@${config.local.cardBoard}`)
  const deckBoards = boards.map((b: string) => `@${boardPrefix}.${b.replace('@', '')}`)
  // an easy way to list them all by using `tb list <configured tag>`
  tags.push(`+${commonTag}`)

  const id = _data.generateID()

  log.info(`initialising flashcard ${id}: ${boards}`)
  const flashcard = new FlashcardTask({
    id,
    description,
    boards: deckBoards,
    tags,
    link,
  })

  // By definition a card will need its "back", which is a comment in Taskbook
  flashcard.writeComment(config.local.editor)

  _data.set(id, flashcard)

  board._save()

  render.successCreate(flashcard)

  if (config.local.enableCopyID) clipboardy.writeSync(String(id))
}

export default { createCard }
