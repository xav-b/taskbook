import { TaskPriority } from '../domain/task'
import { Maybe } from '../types'

const DEFAULT_TASK_PRIORITY = 1

// TODO: parse `duration` as `2h`, `35m`, ...
// for now expecting minutes integer
export function parseDuration(minutes: Maybe<number>): Maybe<number> {
  if (minutes === null || minutes <= 0) return null

  // convert to UNIX ms so it's easy to work with timestamps created with `New
  // Date().getTime()`
  return minutes * 60 * 1000
}

// TODO: let `@` and `+` be customised? Easy but will be a pain? nd compatibility?
export const isPriorityOpt = (x: string): boolean => ['p:1', 'p:2', 'p:3'].indexOf(x) > -1

export const isBoardOpt = (x: string): boolean => x.startsWith('@')

export const isTagOpt = (x: string): boolean => x.startsWith('+')

export function getPriority(desc: string[]): TaskPriority {
  const opt = desc.find((x) => isPriorityOpt(x))
  return opt ? parseInt(opt[opt.length - 1]) : DEFAULT_TASK_PRIORITY
}

export function hasTerms(str: string, terms: string[]): boolean {
  for (const term of terms) {
    if (str.toLocaleLowerCase().indexOf(term.toLocaleLowerCase()) > -1) return true
  }

  return false
}
