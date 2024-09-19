import { sql } from 'drizzle-orm'
import { unique, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const bullets = sqliteTable(
  'bullets',
  {
    // the database id
    id: text('id').primaryKey(),
    // the recycled, productive id for humans
    // TODO: index too
    // TODO: ctxId rename
    ctx_id: integer('ctx_id').notNull(),

    context: text('context'),
    // TODO: could be an enum: desk | archive | bin
    bucket: text('bucket'),

    // TODO: could be an enum
    bulletType: text('bullet_type').notNull(),
    isTask: integer('is_task', { mode: 'boolean' }).notNull(),
    isStarred: integer('is_starred', { mode: 'boolean' }),
    isComplete: integer('is_complete', { mode: 'boolean' }).default(false),
    inProgress: integer('is_inprogress', { mode: 'boolean' }).default(false),
    description: text('description').notNull(),
    comment: text('comment'),
    link: text('link'),
    // NOTE: can this be an enum?
    priority: integer('priority').default(1).notNull(),
    repeat: text('repeat'),

    boards: text('boards', { mode: 'json' }).$type<string[]>(),
    tags: text('tags', { mode: 'json' }).$type<string[]>(),

    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    // NOTE: I think it forces to insert a Date and Drizzle will do the conversion?
    // duration: integer('duration', { mode: 'timestamp_ms' }),
    duration: integer('duration'),
    estimate: integer('estimate'),
    schedule: integer('schedule'),

    createdAt: integer('created_at')
      .notNull()
      .default(sql`(cast(UNIXEPOCH() AS INT))`),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(cast(UNIXEPOCH() AS INT))`),
  },
  (bullets) => ({
    taskIdx: index('ctx_id_idx').on(bullets.ctx_id),
    bucketUniqueConstraint: unique('bucket_unique_constraint').on(
      bullets.context,
      bullets.bucket,
      bullets.ctx_id
    ),
  })
)
