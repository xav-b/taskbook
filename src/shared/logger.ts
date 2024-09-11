import fs from 'fs'
import path from 'path'
import stream from 'node:stream'

import { Signale } from 'signale'

// the reason to log to /tmp is that logs are expected to be very much
// transient. Who will dig logs from days ago? The point would always be
// imediate troubleshooting. And so we get here something simpler (not
// importing `config`) and with logrotation taken care off (reboot your
// computer sometimes duh)
const LOGS_PATH = path.join('/tmp', 'taskbook.logs')

export default (scope: string) => {
  const streams: stream.Writable[] = [
    fs.createWriteStream(LOGS_PATH, {
      flags: 'a',
      encoding: 'utf8',
      autoClose: true,
    }),
  ]

  if (process.env.TB_DEBUG === 'true') streams.push(process.stdout)

  return new Signale({
    scope: scope.padEnd(15),
    // @ts-ignore
    stream: streams,
    // disabled: process.env.TB_ENABLE_LOGGER !== 'true',
    interactive: false,
    types: {
      // @ts-ignore
      debug: {
        badge: '',
      },
      // @ts-ignore
      info: {
        badge: '',
      },
    },
  })
}
