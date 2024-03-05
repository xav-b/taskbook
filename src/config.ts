import fs from 'fs'
import os from 'os'
import path from 'path'
import chalk from 'chalk'

import Logger from './shared/logger'
import pkg from '../package.json'

// for self-documentation, should use from ./domain/task
type PriorityLevel = 1 | 2 | 3

export interface IConfig {
  taskbookDirectory: string
  displayCompleteTasks: boolean
  displayProgressOverview: boolean
  displayWarnings: boolean
  priorities: Record<PriorityLevel, Function>
  highlightTitle: Function
  enableCopyID: boolean
  eventBoard: string
  goalsBoard: string
  defaultBoard: string
  editor: string
  suspiciousDuration: number
  defaultContext: string
  tshirtSizes: boolean
  plannedHoursWarn: number
  plannedHoursError: number
}

const log = Logger()
const { default: defaultConfig } = pkg.configuration
// TODO: https://github.com/sindresorhus/env-paths
const CONFIG_DIR = '.config'

class Config {
  private _configPath: string
  private _configFile: string

  constructor() {
    // old taskbook was using this and it has far more users than my package.
    // Pretty easy to be compatible, no need to force users into migration
    const legacyConfigPath = path.join(os.homedir(), '.taskbook')
    if (fs.existsSync(legacyConfigPath)) this._configPath = path.join(legacyConfigPath)
    else this._configPath = path.join(os.homedir(), CONFIG_DIR, pkg.name)

    this._configFile = path.join(this._configPath, 'config.json')

    this.ensureConfigFile()
  }

  /**
   * Create the file from the default configuration in `package.json`.
   * Worth noting we have a few defaults going on:
   * - package.json -> used to kickstart the config the first time. tHis could
   *   be actually empty because of point below.
   * - `this.defaults()` which defines reasonnable defaults and constants for
   *   all configuration parameters. Will be overwritten by anything updated by
   *   the user in ~/.config/taskbook/config.json
   *
   */
  private ensureConfigFile() {
    if (fs.existsSync(this._configFile)) return

    const data = JSON.stringify(defaultConfig, null, 4)
    fs.writeFileSync(this._configFile, data, 'utf8')
  }

  userConfig(): Partial<Record<keyof IConfig, any>> {
    const content = fs.readFileSync(this._configFile, 'utf8')
    return JSON.parse(content)
  }

  private defaults(): IConfig {
    return {
      taskbookDirectory: this._configPath,
      displayCompleteTasks: true,
      displayProgressOverview: true,
      displayWarnings: true,
      enableCopyID: false,
      defaultBoard: 'My Board',
      eventBoard: 'calendar',
      goalsBoard: 'goals',
      // NOTE: will have to do with theming if implemented
      priorities: { 1: chalk, 2: chalk.yellow, 3: chalk.red },
      highlightTitle: chalk.bold.cyan,
      // TODO: have it under a `theme with the above and use it everywhere
      // grey: chalk.cyan.dim,
      editor: process.env.EDITOR || 'vi',
      suspiciousDuration: 3 /* hours */,
      defaultContext: 'default',
      tshirtSizes: true,
      plannedHoursWarn: 6,
      plannedHoursError: 8,
    }
  }

  set(key: keyof IConfig, value: any) {
    log.info(`updating user config with ${key} = ${value}`)
    const localConf = this.userConfig()
    localConf[key] = value

    const data = JSON.stringify(localConf, null, 4)
    fs.writeFileSync(this._configFile, data, 'utf8')
  }

  get(): IConfig {
    const config = this.userConfig()

    return {
      // sound constants
      ...this.defaults(),
      // ~/.config/taskbook/config.json
      ...config,
    }
  }
}

export default new Config()
