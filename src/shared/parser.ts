import { TaskPriority } from '../domain/task'
import { Maybe } from '../types'

const DEFAULT_TASK_PRIORITY = 1

interface ILineParserOps {
  defaultBoard: string
}

interface ILineStruct {
  boards: string[]
  tags: string[]
  description: string
  priority: TaskPriority
}

// TODO: parse `duration` as `2h`, `35m`, ...
// for now expecting minutes integer
export function parseDuration(minutes: Maybe<number>): Maybe<number> {
  if (minutes === null || minutes <= 0) return null

  // convert to UNIX ms so it's easy to work with timestamps created with `New
  // Date().getTime()`
  return minutes * 60 * 1000
}

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

/**
 * Main parsing entry point - extract the actual description
 * nd the specific objets like boards and priorities.
 */
export function parseOptions(input: string[], config?: ILineParserOps): ILineStruct {
  const boards: string[] = []
  const tags: string[] = []
  const desc: string[] = []

  /** TODO: move that logic on the cli validation
   * if (input.length === 0) {
   *   render.missingDesc()
   *   process.exit(1)
   * }
   */

  // TODO: get that out
  // const id = this._data.generateID()
  const priority = getPriority(input)

  input.forEach((x) => {
    // priorities: already processed
    if (isPriorityOpt(x)) {
      // priorities were already processed
    } else if (isBoardOpt(x)) {
      return boards.push(x)
    } else if (isTagOpt(x)) {
      return tags.push(x)
    } else if (x.length >= 1) {
      return desc.push(x)
    }

    // make linter happy
    return null
  })

  const description = desc.join(' ')

  if (boards.length === 0 && config) boards.push(config.defaultBoard)

  return { boards, tags, description, priority }
}
