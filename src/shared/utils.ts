import crypto from 'crypto'
import Item from '../domain/item'
import Task from '../domain/task'
import { Maybe } from '../types'

// TODO: parse `duration` as `2h`, `35m`, ...
// for now expecting minutes integer
export function parseDuration(minutes: Maybe<number>): Maybe<number> {
  if (!minutes) return null

  // convert to UNIX ms so it's easy to work with timestamps created with `New
  // Date().getTime()`
  return minutes * 60 * 1000
}

export function randomHexString(length = 8) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length)
}

const _arrayify = (x: string | string[]): string[] => (Array.isArray(x) ? x : [x])

// TODO: to review, should not need to handle a string
export const removeDuplicates = (x: string | string[]): string[] => [...new Set(_arrayify(x))]

// TODO: move that to utils or something
export function sortByPriorities(t1: Item, t2: Item): number {
  // we want to have top priorities first, down to lowest so here the highest
  // priority should come as "lower" than the lowest ones
  if (t1 instanceof Task && t2 instanceof Task) return t2.priority - t1.priority

  // can't sort by priority for types that have no priority
  return 0
}
