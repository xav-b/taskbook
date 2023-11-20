import { TaskPriority } from '../domain/task'

const DEFAULT_TASK_PRIORITY = 1

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
