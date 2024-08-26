import { Command } from 'commander'
import Taskbook from '../use_cases/taskbook'

export default abstract class BulletBoardPlugin {
  abstract register(program: Command, board: Taskbook): void
}
