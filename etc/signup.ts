#!/usr/bin/env node

/**
 * Scripting of client-side user signup.
 *
 * Credits: https://turso.tech/blog/working-with-clerk-and-per-user-databases
 */

import crypto from 'crypto'
import { createClient } from '@tursodatabase/api'

const DB_NAME_PREFIX = 'tb'
const TURSO_DB_GROUP = 'taskbook'

export const md5 = (contents: string) => crypto.createHash('md5').update(contents).digest('hex')

const config = {
  // create it at https://app.turso.tech/api-tokens
  token: process.env.TURSO_USER_API_TOKEN!,
  // org: process.env.TURSO_ORG_NAME!,
  // schema: process.env.TURSO_SCHEMA_DATABASE_NAME!,
  org: 'xav-b',
  schema: 'taskbook-template',
}

const turso = createClient({
  token: config.token,
  org: config.org,
})

const dbName = (userId: string) => `${DB_NAME_PREFIX}-${md5(userId)}`

async function checkDatabaseExists(userId: string): Promise<string | null> {
  const databaseName = dbName(userId)

  try {
    const res = await turso.databases.get(databaseName)
    console.log(`found db ${databaseName}: ${res.id}`)
    return res.id
  } catch {
    return null
  }
}

async function signup(userId: string) {
  const databaseName = dbName(userId)

  // TODO: check if that database exists
  const exists = await checkDatabaseExists(userId)
  if (exists) {
    console.log(`database of user ${userId} already exists: ${exists}`)
    return
  }

  try {
    console.log(`creating database '${databaseName} of user '${userId}'`)
    const ack = await turso.databases.create(databaseName, {
      schema: config.schema!,
      group: TURSO_DB_GROUP,
    })
    console.log(`successfully created db: ${ack.hostname}`)

    const token = await turso.databases.createToken(ack.name, {
      expiration: 'never',
      authorization: 'full-access', // or 'read-only'
    })

    console.log(`successfully created '${ack.name}' db token:`)
    console.log(token.jwt)
  } catch (err) {
    throw new Error('Database creation failed')
  }

  return
}

console.log('config:', config)
signup('xavier')
  .then(() => console.log('done'))
  .catch((err) => console.error('failed', err))
