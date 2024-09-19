#!/usr/bin/env node

import { nanoid } from 'nanoid'

import Task from '../src/domain/task'
import Note from '../src/domain/note'
import CalendarEvent, { EventProperties } from '../src/plugins/bb-domain-event/event'
import Goal from '../src/plugins/bb-domain-goal/goal'
import Flashcard from '../src/plugins/bb-domain-card/card'
import IBullet, { IBulletOptions } from '../src/domain/ibullet'
import Catalog from '../src/domain/catalog'

// TODO: cli or at least args
const context = 'demo'
const bucket = 'index'
// TODO: replace HOME
const legacy: Record<string, IBulletOptions> = require(
  `/Users/xavier/.config/taskbook/${context}/storage/${bucket}.json`
)

function parseRawItem(item: IBulletOptions): IBullet {
  if (item._type === 'task') return new Task(item as IBulletOptions)
  else if (item._type === 'note') return new Note(item as IBulletOptions)
  else if (item._type === 'event') return new CalendarEvent(item as EventProperties)
  else if (item._type === 'goal') return new Goal(item as IBulletOptions)
  else if (item._type === 'flashcard') return new Flashcard(item as IBulletOptions)

  throw new Error(`[warning] unknown item type: ${item._type}`)
}

console.log('Will load', Object.keys(legacy).length, 'items', context, bucket)

async function main() {
  // TODO: if bucket is `index`, change it to `desk`
  const desk = new Catalog(context, bucket)
  for (const [key, item] of Object.entries(legacy)) {
    try {
      item.id = parseInt(key)
      console.log(item.id, item.description)
      await desk.set(parseRawItem(item), item.id)
    } catch (err) {
      console.log(`failed to insert item #${item.id}`, item, err)
      item._uid = nanoid()
      console.log(`trying again under uid ${item._uid}`)
      await desk.set(parseRawItem(item), item.id)
    }
  }
}

main()
