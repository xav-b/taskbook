/**
 * Google calendar Nodejs client
 *
 * Copy/pasted from https://developers.google.com/calendar/api/quickstart/nodejs?authuser=1
 */

const fs = require('fs').promises
const path = require('path')
const process = require('process')

const debug = require('debug')('tb:plugin:event:gcal')
const { authenticate } = require('@google-cloud/local-auth')
const { google } = require('googleapis')

import { today, prettyTzOffset } from './utils'

const CALENDAR_VERSION = 'v3'
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
const CREDENTIALS_PATH = path.join(process.cwd(), 'gapi-credentials.json')

/**
 * The token file stores the user's access and refresh tokens, and is
 * created automatically when the authorization flow completes for the first
 * time.
 * Unlike the crendetials which are tied to the app and remain persistent, it
 * will change for different calendars and will need to be renewed.
 */
const tokenPath = (calendar) => path.join(process.cwd(), `gapi-token.${calendar || 'default'}.json`)

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist(calendar) {
  const savedTokenPath = tokenPath(calendar)
  try {
    debug(`attempting to read saved google credentials from '${savedTokenPath}'`)
    const content = await fs.readFile(savedTokenPath)
    const credentials = JSON.parse(content)
    return google.auth.fromJSON(credentials)
  } catch (err) {
    debug(`failed to authenticate from JSON file '${savedTokenPath}': ${err}`)
    return null
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client, calendar) {
  const content = await fs.readFile(CREDENTIALS_PATH)
  const keys = JSON.parse(content)
  const key = keys.installed || keys.web
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  })
  await fs.writeFile(tokenPath(calendar), payload)
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize(calendarName) {
  debug(`tentatively loading credentials (calendar=${calendarName})`)
  let client = await loadSavedCredentialsIfExist(calendarName)

  // TODO: detect expired credentials
  if (client) {
    debug('credentials found - authenticated')
    return client
  }

  debug('no crendetials found, authenticate')
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  })

  if (client.credentials) {
    debug('saving auth (refresh) token')
    await saveCredentials(client, calendarName)
  } else throw new Error('no auth token found')

  debug('authentication successfully completed')
  return client
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listEvents(auth, opts) {
  const calendar = google.calendar({ version: CALENDAR_VERSION, auth })

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
    showDeleted: false,

    // overwrite with user-provided options
    ...opts,
  })

  // handle failures modes
  if (!res.data.items || res.data.items.length === 0) {
    debug('no upcoming events found')
    return []
  }

  return res.data.items
    .map((event) => {
      debug(`processing event ${event.id}`)

      if (event.status === 'confirmed' && event.kind === 'calendar#event') {
        if (event.start.dateTime === undefined) {
          debug('full day event - ignoring')
          return null
        }

        const startTime = new Date(event.start.dateTime)
        const endTime = new Date(event.end.dateTime)

        return {
          id: event.id,
          title: event.summary,
          description: event.description || null,
          link: event.htmlLink,
          startTime,
          endTime,
          duration: endTime - startTime,
        }
      }
    })
    .filter((each) => each !== null)
}

// authorize().then(listEvents).catch(console.error)
async function _example() {
  const auth = await authorize()

  // get today events
  const timeMin = `${today()}T00:00:00${prettyTzOffset}`
  const timeMax = `${today()}T23:59:59${prettyTzOffset}`

  const events = await listEvents(auth, { timeMin, timeMax })

  console.log(events)
}

export default { authorize, listEvents }
