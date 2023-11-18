import fs from 'fs'
import os from 'os'
import path from 'path'
import chalk from 'chalk'

import pkg from '../package.json'

// for self-documentation
type PriorityLevel = 1 | 2 | 3

interface IConfig {
  taskbookDirectory: string
  displayCompleteTasks: boolean
  displayProgressOverview: boolean
  displayWarnings: boolean
  priorities: Record<PriorityLevel, Function>
  highlightTitle: Function
  enableCopyID: boolean
  eventBoard: string
  defaultBoard: string
  editor: string
  suspiciousDuration: number
}

const { default: defaultConfig } = pkg.configuration
// TODO: https://github.com/sindresorhus/env-paths
// TODO: Have a fallback on ~/.taskbook
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

    this._ensureConfigFile()
  }

  _ensureConfigFile() {
    if (fs.existsSync(this._configFile)) {
      return
    }

    const data = JSON.stringify(defaultConfig, null, 4)
    fs.writeFileSync(this._configFile, data, 'utf8')
  }

  get(): IConfig {
    const content = fs.readFileSync(this._configFile, 'utf8')
    const config = JSON.parse(content)

    return {
      // defaults
      taskbookDirectory: this._configPath,
      // TODO: support in package.json and/or environment
      // constants
      // NOTE: will have to do with theming if implemented
      priorities: { 2: chalk.underline.yellow, 3: chalk.underline.red },
      highlightTitle: chalk.bold.cyan,
      defaultBoard: 'My Board',
      editor: process.env.EDITOR || 'vi',
      suspiciousDuration: 3 /* hours */,

      // ~/.config/taskbook/config.json
      ...config,

      /**
       * TODO: not supported yet (would really benefit from a flat config)
       * defaultBoard: 'My Board',
       * editor: process.env.EDITOR || 'vi',
       * prioritiesLabels: ['p:1', 'p:2', 'p:3'],
       * boardPrefix: '@',
       * tagPrefix: '+',
       */
    }
  }
}

export default new Config()
