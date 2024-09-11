import fs from 'fs'
import os from 'os'
import path from 'path'

import chalk from 'chalk'
import TOML, { AnyJson, JsonMap } from '@iarna/toml'
import { Priority } from '../domain/ibullet'
import PKG from '../../package.json'

const debug = require('debug')('tb:config')

/**
 * Mutable state.
 *
 * FIXME: it's redundant with storage/localcache.
 */
interface LocalState extends JsonMap {
  currentContext: string
}

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
  tshirtSizes: boolean
  plannedHoursWarn: number
  plannedHoursError: number
  greetings: boolean
  doneLast: boolean
  defaultTaskEstimate: number
  showAge: boolean
  highlightTags: string[]
}

type PluginConfig = Record<string, AnyJson>
type AliasConfig = Record<string, string>

interface ThemeConfig {
  priorities: Record<Priority, chalk.Chalk>
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
const STATE_FILE = path.join(CONFIG_PATH, 'state.v2.toml')
const ENCODING = 'utf8'
const DEFAULT_CONTEXT = 'default'
const POMODORO_STRATEGY = 25 // minutes - default task estimate

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
  tshirtSizes: true,
  plannedHoursWarn: 6,
  plannedHoursError: 8,
  greetings: true,
  doneLast: true,
  defaultTaskEstimate: POMODORO_STRATEGY,
  showAge: true,
  // those tags will be prefixed and highlighted in tag display
  highlightTags: [],
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

function ensureLocalState(): void {
  debug('verifying local state')
  if (fs.existsSync(STATE_FILE)) return

  debug(`writing default state for the first time: ${STATE_FILE}`)
  // TODO: once stable, just write the string directly with everything
  // commented out
  const serialized = TOML.stringify({
    currentContext: DEFAULT_CONTEXT,
  })
  fs.writeFileSync(STATE_FILE, serialized, ENCODING)
}

function parseUserlandConfig(): {
  local: UserConfig
  plugins: Record<string, PluginConfig>
  aliases: AliasConfig
} {
  debug('loading local configuration', CONFIG_FILE)

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

function parseUserlandState(): LocalState {
  debug('loading local state', STATE_FILE)

  const data = fs.readFileSync(STATE_FILE, { encoding: ENCODING })
  const parsed = TOML.parse(data)

  const defaults = { currentContext: DEFAULT_CONTEXT }
  return { ...defaults, ...(parsed as LocalState) }
}

export class IConfig {
  public local: UserConfig

  public theme: ThemeConfig

  public plugins: Record<string, PluginConfig>

  public aliases: AliasConfig

  public state: LocalState

  constructor() {
    ensureUserConfig()
    ensureLocalState()

    const state = parseUserlandState()
    const { local, plugins, aliases } = parseUserlandConfig()

    this.state = state
    this.local = local
    this.plugins = plugins
    this.aliases = aliases
    this.theme = defaultThemeConfig()
  }

  // FIXME: this method deletes the comments - overall this might just be a bad
  // idea and mutable state should live elswhere
  public update(key: keyof LocalState, value: AnyJson) {
    this.state[key] = value

    debug(`updating local state: ${key}=${value}`)
    const data = TOML.stringify(this.state)
    fs.writeFileSync(STATE_FILE, data, ENCODING)
  }
}

debug('initiating configuration')
const configSingleton = new IConfig()
debug('global config ready')

export default configSingleton
