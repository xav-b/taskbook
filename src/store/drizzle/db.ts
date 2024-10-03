import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import Logger from '../../shared/logger'
import * as schema from './schema'
import config from '../../config'

const log = Logger('store.db')

type ConnectionOpts = {
  isMigration?: boolean
  logger?: boolean
}

function connect(opts: ConnectionOpts = {}): LibSQLDatabase<typeof schema> {
  log.info(`initialising Turso DB: ${config.store.turso.url}`)
  // migration can only happen on local files with remote replica off
  const client = opts.isMigration
    ? createClient({ url: config.store.turso.url })
    : createClient(config.store.turso)

  // TODO: let the caller add options
  return drizzle(client, { schema, logger: opts.logger || false })
}

export default { connect }
