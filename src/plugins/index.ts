import { Command } from 'commander'
import Taskbook from '../use_cases/taskbook'

export default abstract class BulletBoardPlugin {
  // static mapping of key/default value that will be merged into the main
  // config object, accessible as `board.config.{plugin}`
  static config: Record<string, any>
  abstract register(program: Command, board: Taskbook): void
}
