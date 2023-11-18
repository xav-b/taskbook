import { TaskPriority } from '../domain/task'

// TODO: let `@` and `+` be customised? Easy but will be a pain? nd compatibility?
export const isPriorityOpt = (x: string): boolean => ['p:1', 'p:2', 'p:3'].indexOf(x) > -1

export const isBoardOpt = (x: string): boolean => x.startsWith('@')

export const isTagOpt = (x: string): boolean => x.startsWith('+')

export function getPriority(desc: string[]): TaskPriority {
  const opt = desc.find((x) => isPriorityOpt(x))
  // TODO: return Task.TaskPriority but it's a `number`, make it consistent
  return opt ? parseInt(opt[opt.length - 1]) : 1
}

export function hasTerms(str: string, terms: string[]): string | null {
  for (const term of terms) {
    if (str.toLocaleLowerCase().indexOf(term.toLocaleLowerCase()) > -1) {
      return str
    }
  }

  return null
}
