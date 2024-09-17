#!/usr/bin/env node

import { nanoid } from 'nanoid'
import { Command } from 'commander'
import Taskbook from '../src/use_cases/taskbook'
import Logger from '../src/shared/logger'

const program = new Command()
const log = Logger('cli.outline.parser', true)

type BoardID = string

function slugify(str: string) {
  return String(str)
    .normalize('NFKD') // split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
    .trim() // trim leading or trailing whitespace
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-') // remove consecutive hyphens
}

class TBTask {
  uid: string
  raw: string
  description: string[]
  board: string
  subtasks: string[]

  constructor(board: string, description: string) {
    this.uid = nanoid()
    this.board = board
    this.subtasks = []
    this.raw = description
    this.description = description.split(' ')
    this.description.push(`@${board}`)
  }

  addSubtask(subtask: string) {
    this.subtasks.push(subtask)
  }
}

class OutlineParserState {
  context: string
  boards: string[]
  tasks: Record<BoardID, TBTask>

  // cursors
  _currentBoard: string | null
  _currentTask: string | null

  constructor() {
    this.context = 'default'
    this.boards = []
    this.tasks = {}

    // initialise cursors
    this._currentBoard = null
    this._currentTask = null
  }

  processLine(line: string) {
    if (line.startsWith('# ')) this.context = slugify(line.slice(2))
    else if (line.startsWith('- ')) {
      const board = slugify(line.slice(2))
      this._currentBoard = board
      this.boards.push(board)
    } else if (line.startsWith('  - ')) {
      const taskBoard = this._currentBoard || 'backlog'
      const task = new TBTask(taskBoard, line.slice(4))
      this.tasks[task.uid] = task
      this._currentTask = task.uid
    } else if (line.startsWith('    - ')) {
      if (this._currentTask === null) throw new Error(`can't add subtasks without a current task`)
      this.tasks[this._currentTask].subtasks.push(line.slice(6))
    } else if (line === '') log.debug(`ignoring space`)
    // NOTE: should we save them as notes?
    else log.debug(`ignoring line: ${line}`)
  }

  generate() {
    const board = new Taskbook(this.context)

    for (const t of Object.values(this.tasks)) {
      log.info(`creating task ${t.uid}: ${t.raw}`)
      // generating the comment from the subtasks
      let comment: string | undefined
      if (t.subtasks?.length) {
        comment = `# task ${t.uid} - ${t.raw}\n\n`
        for (const sub of t.subtasks) comment += `- [ ] ${sub}\n`
      }
      board.createTask(t.description, comment)
    }

    // debug
    console.log(board.listByAttributes(['all']))
  }
}

program
  .name('outline parser')
  .description('Parse an outline within a markdown file')
  .version('0.1.0')
  .argument('[outline]')
  .action((outline) => {
    const state = new OutlineParserState()

    log.info(`parsing outline file: ${outline}`)
    const lineReader = require('readline').createInterface({
      input: require('fs').createReadStream(outline),
    })

    lineReader.on('line', function (line: string) {
      state.processLine(line)
    })

    lineReader.on('close', function () {
      console.log('all done, son')
      // console.log(state)
      console.log(state.generate())
    })
  })

program.parse()
