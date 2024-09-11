const notifier = require('node-notifier')
const udp = require('dgram')

import Logger from '../src/shared/logger'

const PORT = 2222

const log = Logger('ui.server.events')
const server = udp.createSocket('udp4')

server.on('listening', () => {
  const socket = server.address()
  console.log(`listening on ${socket.address}:${socket.port}...`)
})

server.on('message', (message, remote) => {
  log.debug(`${remote.size}b message received from ${remote.address}:${remote.port}`)
  const msg = JSON.parse(message.toString())

  log.debug('received message:', msg)

  // TODO: write a kind of specific handler here
  const { i, estimate } = msg.args

  const notify = (body) => {
    console.log(`notifying`, body)

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
})

server.bind(PORT)
