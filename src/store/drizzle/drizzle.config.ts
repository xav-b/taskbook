import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/store/drizzle/schema.ts',
  out: './src/store/drizzle/migrations',
  dialect: 'sqlite',
  verbose: true,
  strict: true,
  // TODO: can i import taskbook config to solve this?
  dbCredentials: {
    url: `${process.env.HOME}/.config/taskbook/taskbook.db`,
  },
  migrations: {
    prefix: 'supabase',
  },
})
