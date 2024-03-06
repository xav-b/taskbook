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

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
// TODO: const TOKEN_PATH = path.join(process.cwd(), 'gapi-token.json')
const TOKEN_PATH = path.join(process.cwd(), 'gapi-token.json')
const CREDENTIALS_PATH = path.join(process.cwd(), 'gapi-credentials.json')

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH)
    const credentials = JSON.parse(content)
    return google.auth.fromJSON(credentials)
  } catch (err) {
    return null
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH)
  const keys = JSON.parse(content)
  const key = keys.installed || keys.web
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  })
  await fs.writeFile(TOKEN_PATH, payload)
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  debug('tentatively loading credentials')
  let client = await loadSavedCredentialsIfExist()
  if (client) {
    debug('got them - authenticated')
    return client
  }

  debug('no crendetials found, authenticate')
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  })

  if (client.credentials) {
    debug('saving credentials')
    await saveCredentials(client)
  }

  debug('authentication successfully completed')
  return client
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listEvents(auth, opts) {
  const calendar = google.calendar({ version: 'v3', auth })

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
    return
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
  const todayDate = new Date().toISOString().replace(/T.*/, '')
  const timeMin = `${todayDate}T00:00:00+08:00`
  const timeMax = `${todayDate}T23:59:59+08:00`

  const events = await listEvents(auth, { timeMin, timeMax })

  console.log(events)
}

module.exports = { authorize, listEvents }
