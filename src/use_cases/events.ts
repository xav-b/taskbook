import udp from 'dgram'
import Logger from '../shared/logger'

const log = Logger('core.events')

log.info('connecting udp4 socket')
const client = udp.createSocket('udp4')

// TODO: configuration
const UDP_PORT = 2222
const UDP_HOST = '0.0.0.0'

export interface EventPayload {
  command: string
  event: string
  msg: string
  args?: Record<string, any>
}

const serialize = (payload: EventPayload) => Buffer.from(JSON.stringify(payload))

async function fire(event: string, payload: Omit<EventPayload, 'event'>): Promise<Error | void> {
  return new Promise((resolve: Function, reject: Function) => {
    log.info(`firing event "${event}" on ${UDP_HOST}:${UDP_PORT}`)

    const packet = serialize({ event, ...payload })

    // fire and forget
    client.send(packet, UDP_PORT, UDP_HOST, (err) => {
      log.debug(`udp message ack: ${err}`)
      if (err) reject(err)
      else resolve()
    })
  })
}

export default { fire, close: () => client.close() }
