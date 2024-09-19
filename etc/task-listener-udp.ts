#!/usr/bin/env node

const notifier = require('node-notifier')
import udp, { RemoteInfo } from 'dgram'
import { Command } from 'commander'
import { EventPayload } from '../src/use_cases/events'
import Taskbook from '../src/use_cases/taskbook'
import render from '../src/interfaces/render'
import Logger from '../src/shared/logger'

const PORT = 2222
const EVENTS_NEED_REFRESH = ['task checked', 'tasks moved']

const program = new Command()
const log = Logger('ui.server.events', true)

async function displayBoard(attributes: string[]) {
  // could be headless
  if (attributes.length === 0) return

  // we get a new tasbook everytime so we pick up on any update.
  // Alternatively we could implement a `taskbook.reload()` to resync on
  // storage state.
  const taskbook = new Taskbook()

  // TODO: clear the screen

  // pull the relevant data
  const { data, groups } = await taskbook.listByAttributes(attributes)
  const stats = data.stats()
  const tasksGrouped = data.groupByBoards(groups)

  // display
  render.displayByBoard(tasksGrouped, true)
  render.displayStats(stats)
}

function handleTimer(msg: EventPayload) {
  if (!msg.args) {
    log.error(`no countdown information, aborting handler`)
    return
  }

  const { i, estimate } = msg.args

  const notify = (body: string) => {
    log.info(`notifying`, body)

    notifier.notify({
      title: 'Task Countdown',
      message: body,
      sound: false,
    })
  }

  // notify a few times:
  // - halfway through
  // - 10min away (if estimate > 20)
  // - 5min away (if estimate > 10)
  // - 1min away
  // - done
  if (i === estimate) notify(`🏎️ timer completed`)
  else if (estimate - i < 2) notify(`🚴 1 minute left!`)
  else if (estimate - i === 5 && estimate > 10) notify(`🏃 5 minutes left!`)
  else if (estimate - i === 10 && estimate > 20) notify(`🏃 10 minutes left!`)
  else if (estimate - i === Math.round(estimate / 2)) notify(`🚶 Halfway through!`)
}

program
  .name('udp-server')
  .description('Taskbook UDP Server')
  .version('0.1.0')
  .argument('[attributes...]')
  .action(async (attributes) => {
    const server = udp.createSocket('udp4')

    server.on('listening', () => {
      const socket = server.address()
      log.info(`listening on ${socket.address}:${socket.port}...`)
    })

    // initial display
    await displayBoard(attributes)

    server.on('message', (message: Buffer, remote: RemoteInfo) => {
      log.debug(`${remote.size}b message received from ${remote.address}:${remote.port}`)
      const msg = JSON.parse(message.toString()) as EventPayload

      log.debug(`received new event: ${msg.event}`)

      // all the events that should update the board
      if (EVENTS_NEED_REFRESH.includes(msg.event)) {
        // TODO: we could check if the task belongs to the attributes and only
        // update then
        displayBoard(attributes)
      } else if (msg.event === 'task timer updated') {
        handleTimer(msg)
      }
    })

    server.bind(PORT)
  })

program.parse()
