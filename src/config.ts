import fs from 'fs'
import os from 'os'
import path from 'path'
import chalk from 'chalk'

import pkg from '../package.json'

// for self-documentation
type ChalkColorString = string
type PriorityLevel = 1 | 2 | 3

interface IConfig {
  taskbookDirectory: string
  displayCompleteTasks: boolean
  displayProgressOverview: boolean
  displayWarnings: boolean
  priorities: Record<PriorityLevel, ChalkColorString>
  highlightTitle: string
  enableCopyID: boolean
  eventBoard: string
}

const { default: defaultConfig } = pkg.configuration
// TODO: https://github.com/sindresorhus/env-paths
const CONFIG_DIR = '.config'

class Config {
  private _configPath: string
  private _configFile: string

  constructor() {
    // supprot for cross platform standard paths
    this._configPath = path.join(os.homedir(), CONFIG_DIR, pkg.name)
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
      // ~/.taskbook/config.json
      ...config,

      taskbookDirectory: this._configPath,
      // TODO: support in package.json and/or environment
      // constants
      // NOTE: will have to do with theming if implemented
      priorities: { 2: 'yellow', 3: 'red' },
      highlightTitle: chalk.bold.cyan,

      /**
       * TODO: not supported yet (would really benefit from a flat config)
       * defaultBoard: 'My Board',
       * editor: process.env.EDITOR || 'vi',
       * prioritiesLabels: ['p:1', 'p:2', 'p:3'],
       * boardPrefix: '@',
       * tagPrefix: '+',
       * suspiciousDuration: 3 // hours
       */
    }
  }
}

export default new Config()
