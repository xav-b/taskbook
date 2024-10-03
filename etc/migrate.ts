#!/usr/bin/env node

import { migrate } from 'drizzle-orm/libsql/migrator'
import db from '../src/store/drizzle/db'

// This will run migrations on the database, skipping the ones already applied
migrate(db.connect({ isMigration: true, logger: true }), {
  migrationsFolder: './src/store/drizzle/migrations',
})
  .then(console.log)
  .catch(console.error)
