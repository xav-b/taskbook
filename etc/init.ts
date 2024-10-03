#!/usr/bin/env node

import { createClient } from '@libsql/client'
import config from '../src/config'

async function connect() {
  console.log(`initialising Turso DB: ${config.store.turso.url}`)
  // migration can only happen on local files with remote replica off
  const client = createClient(config.store.turso)

  await client.sync()
}

connect().then(console.log).catch(console.error)
