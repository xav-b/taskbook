import crypto from 'crypto'
import { Maybe } from '../types'

// TODO: parse `duration` as `2h`, `35m`, ...
// for now expecting minutes integer
export function parseDuration(minutes: number): Maybe<number> {
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
