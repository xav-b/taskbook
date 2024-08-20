import fs from 'fs'
import os from 'os'
import path from 'path'

import chalk from 'chalk'
import TOML, { AnyJson, JsonMap } from '@iarna/toml'
import PKG from '../../package.json'

const debug = require('debug')('tb:config')

// TODO: for self-documentation, should use from ./domain/ibullet:Priority
type PriorityLevel = 1 | 2 | 3

/**
 * User facing configuration.
 * Global config minus any code-side manipulations and, mostly actually,
 * whatever is not serializable to toml.
 */
interface UserConfig extends JsonMap {
  taskbookDirectory: string
  displayCompleteTasks: boolean
  displayProgressOverview: boolean
  displayWarnings: boolean
  enableCopyID: boolean
  defaultBoard: string
  editor: string
  suspiciousDuration: number
  defaultContext: string
  tshirtSizes: boolean
  plannedHoursWarn: number
  plannedHoursError: number
  greetings: boolean
  doneLast: boolean
}

type PluginConfig = Record<string, AnyJson>
type AliasConfig = Record<string, string>

interface ThemeConfig {
  priorities: Record<PriorityLevel, chalk.Chalk>
  highlightTitle: chalk.Chalk
  grey: chalk.Chalk
}

// TODO: make it multi-platform and comply more with standards
// https://github.com/sindresorhus/env-paths/blob/main/index.js
//
// NOTE: The filename may actually grow in interest, providing we may support
// per-context configuration, or just isolated profiles.
const CONFIG_PATH = path.join(os.homedir(), '.config', PKG.name)
const CONFIG_FILE = path.join(CONFIG_PATH, 'config.v2.toml')
const ENCODING = 'utf8'

const userDefaults: UserConfig = {
  taskbookDirectory: CONFIG_PATH,
  displayCompleteTasks: true,
  displayProgressOverview: true,
  displayWarnings: true,
  enableCopyID: false,
  // note `taskbook` was previously using `My board` but that space and
  // capital letter is no longer supported. There were special handlers of
  // `myboard` that ultimately we could try to support (slugify for
  // storage)
  defaultBoard: 'backlog',
  editor: process.env.EDITOR || 'vi',
  suspiciousDuration: 3 /* hours */,
  defaultContext: 'default',
  tshirtSizes: true,
  plannedHoursWarn: 6,
  plannedHoursError: 8,
  greetings: true,
  doneLast: true,
}

const defaultThemeConfig = (): ThemeConfig => ({
  priorities: { 1: chalk, 2: chalk.yellow, 3: chalk.red },
  highlightTitle: chalk.bold.cyan,
  grey: chalk.cyan.dim,
})

function ensureUserConfig(): void {
  debug('verifying config file')
  if (fs.existsSync(CONFIG_FILE)) return

  debug(`writing default config for the first time: ${CONFIG_FILE}`)
  // TODO: once stable, just write the string directly with everything
  // commented out
  const serialized = TOML.stringify({
    taskbook: userDefaults,
    // dummy examples
    plugin: { example: { key: 'value' } },
    alias: { subcommand: 'tb example' },
  })
  fs.writeFileSync(CONFIG_FILE, serialized, ENCODING)
}

function parseUserlandConfig(): {
  local: UserConfig
  plugins: Record<string, PluginConfig>
  aliases: AliasConfig
} {
  debug('building configuration singleton', CONFIG_FILE)

  const data = fs.readFileSync(CONFIG_FILE, {
    encoding: ENCODING,
  })
  const parsed = TOML.parse(data)

  // `local` needs all properties to be set, so we need to handle the case user
  // has removed properties
  const withDefaults = { ...userDefaults, ...(parsed.taskbook as UserConfig) }
  return {
    local: withDefaults,
    plugins: parsed.plugin as Record<string, PluginConfig>,
    aliases: parsed.alias as AliasConfig,
  }
}

// TODO: re-test initial generation
// TODO: merge user config with defaults after loading
export class IConfig {
  public local: UserConfig

  public theme: ThemeConfig

  public plugins: Record<string, PluginConfig>

  public aliases: AliasConfig

  constructor() {
    ensureUserConfig()

    const { local, plugins, aliases } = parseUserlandConfig()

    this.local = local
    this.plugins = plugins
    this.aliases = aliases
    this.theme = defaultThemeConfig()
  }

  public update(key: keyof UserConfig, value: AnyJson) {
    this.local[key] = value

    debug(`updating user config: ${key}=${value}`)
    const data = TOML.stringify({ local: this.local, plugin: this.plugins })
    fs.writeFileSync(CONFIG_FILE, data, ENCODING)
  }
}

export default new IConfig()
