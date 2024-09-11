import udp from 'dgram'
import Logger from '../shared/logger'

const log = Logger('core.events')
const client = udp.createSocket('udp4')

// TODO: configuration
const UDP_PORT = 2222
const UDP_HOST = '0.0.0.0'

interface EventPayloadI {
  command: string
  event: string
  msg: string
  args?: Record<string, any>
}

const serialize = (payload: EventPayloadI) => Buffer.from(JSON.stringify(payload))

function fire(event: string, payload: Omit<EventPayloadI, 'event'>) {
  log.info(`firing event ${event} on ${UDP_HOST}:${UDP_PORT}`)

  const packet = serialize({ event, ...payload })

  // fire and forget
  client.send(packet, UDP_PORT, UDP_HOST, (err) => log.debug(`udp message ack: ${err}`))
}

export default { fire, close: () => client.close() }
