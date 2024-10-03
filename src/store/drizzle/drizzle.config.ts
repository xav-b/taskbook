import { defineConfig } from 'drizzle-kit'
import config from '../../config'

export default defineConfig({
  schema: './src/store/drizzle/schema.ts',
  out: './src/store/drizzle/migrations',
  dialect: 'sqlite',
  verbose: true,
  strict: true,
  // TODO: can i import taskbook config to solve this?
  dbCredentials: {
    // url: `${process.env.HOME}/.config/taskbook/taskbook.db`,
    url: config.store.turso.url,
  },
  migrations: {
    prefix: 'supabase',
  },
})
