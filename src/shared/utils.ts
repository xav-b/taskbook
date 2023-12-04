import fs from 'fs'
import crypto from 'crypto'
import Item from '../domain/item'
import Task from '../domain/task'

export function randomHexString(length = 8) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length)
}

export const removeDuplicates = (x: string[]): string[] => [...new Set(x)]

export function sortByPriorities(t1: Item, t2: Item, pushNullDown = true): number {
  const orderNull = pushNullDown ? -1 : 1
  // we want to have top priorities first, down to lowest so here the highest
  // priority should come as "lower" than the lowest ones
  if (t1 instanceof Task && t2 instanceof Task) return t2.priority - t1.priority
  // if we are here, one of the 2 items is not a task. The behaviour we want is
  // to a) jot affect the sorting of tasks with priorities, and b) push
  // downward/upward
  else if (t1 instanceof Task) return orderNull
  else if (t2 instanceof Task) return -orderNull

  // none of the items are a task, stand still
  return 0
}

export function ensureDir(directory: string) {
  // FIXME: since version 10.12.0 `recursive` option is supported. This bumped
  // the required node from 6 to 10+, which is quite unfortunate for this
  // detail. This also sounds a bit unsafe if somehow we got it wrong. Probably
  // better to remove it and just make sure all directories are carefully and
  // progressively created.
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true })
}
