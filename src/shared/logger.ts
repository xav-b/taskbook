import fs from 'fs'
import path from 'path'
import tracer from 'tracer'

// the reason to log to /tmp is that logs are expected to be very much
// transient. Who will dig logs from days ago? The point would always be
// imediate troubleshooting. And so we get here something simpler (not
// importing `config`) and with logrotation taken care off (reboot your
// computer sometimes dude)
const LOGS_PATH = path.join('/tmp', 'taskbook.logs')

export default () => {
  return tracer.console({
    transport: (data) => {
      fs.appendFile(LOGS_PATH, data.rawoutput + '\n', (err) => {
        if (err) throw err
      })
    },
  })
}
