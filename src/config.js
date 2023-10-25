const fs = require('fs')
const os = require('os')
const path = require('path')
const chalk = require('chalk')
const pkg = require('../package.json')

const { default: defaultConfig } = pkg.configuration

const _formatTaskbookDir = (directory) => path.join(os.homedir(), directory.replace(/^~/g, ''))

class Config {
  constructor() {
    this._configFile = path.join(os.homedir(), '.taskbook', 'config.json')

    this._ensureConfigFile()
  }

  _ensureConfigFile() {
    if (fs.existsSync(this._configFile)) {
      return
    }

    const data = JSON.stringify(defaultConfig, null, 4)
    fs.writeFileSync(this._configFile, data, 'utf8')
  }

  get() {
    let config = {}

    const content = fs.readFileSync(this._configFile, 'utf8')
    config = JSON.parse(content)

    if (config.taskbookDirectory.startsWith('~')) {
      config.taskbookDirectory = _formatTaskbookDir(config.taskbookDirectory)
    }

    return {
      // package.json
      ...defaultConfig,
      // ~/.taskbook/config.json
      ...config,
      // constants
      priorities: { 2: 'yellow', 3: 'red' },
      highlightTitle: chalk.bold.cyan,
      // TODO: support in package.json and/or environment
      enableCopyID: true,

      // TODO: not supported yet
      defaultBoard: 'My Board',
      eventBoard: 'calendar',
      editor: process.env.EDITOR || 'vi',
      prioritiesLabels: ['p:1', 'p:2', 'p:3'],
      boardPrefix: '@',
      tagPrefix: '+',
    }
  }
}

module.exports = new Config()
