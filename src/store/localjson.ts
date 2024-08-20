import fs from 'fs'
import path from 'path'

import config from '../config'
import Storage from '.'
import Task from '../domain/task'
import Note from '../domain/note'
import CalendarEvent from '../plugins/bb-domain-event/event'
import Goal from '../plugins/bb-domain-goal/goal'
import Flashcard from '../plugins/bb-domain-card/card'
import Catalog, { CatalogInnerData } from '../domain/catalog'
import Logger from '../shared/logger'
import { randomHexString, ensureDir } from '../shared/utils'

const { basename, join } = path

const log = Logger()

const DEFAULT_WORKSPACE = 'default'

function parseJson(data: any): Catalog {
  const catalog: CatalogInnerData = {}

  // FIXME: there shouldn't be any knowledge of the plugins here
  Object.keys(data).forEach((id: string) => {
    if (data[id]._type === 'task') catalog[id] = new Task(data[id])
    else if (data[id]._type === 'note') catalog[id] = new Note(data[id])
    else if (data[id]._type === 'event') catalog[id] = new CalendarEvent(data[id])
    else if (data[id]._type === 'goal') catalog[id] = new Goal(data[id])
    else if (data[id]._type === 'flashcard') catalog[id] = new Flashcard(data[id])
    else log.error(`[warning] unknown item type: ${data[id]._type}`)
  })

  return new Catalog(catalog)
}

class LocalJSONStorage implements Storage {
  // local storage is all about directories and files
  _storageDir: string

  _archiveDir: string

  _tempDir: string

  _archiveFile: string

  _binFile: string

  _mainStorageFile: string

  constructor(workspace?: string) {
    // applying the default there as callers may explicitely pass a `null` or
    // `undefined`
    workspace = workspace || DEFAULT_WORKSPACE

    log.info(`initialising workspace storage ${workspace}`)

    this._storageDir = join(this._mainAppDir, workspace, 'storage')
    this._archiveDir = join(this._mainAppDir, workspace, 'archive')
    this._tempDir = join(this._mainAppDir, workspace, '.temp')
    this._archiveFile = join(this._archiveDir, 'archive.json')
    this._binFile = join(this._archiveDir, 'bin.json')
    this._mainStorageFile = join(this._storageDir, 'storage.json')

    this._ensureDirectories()

    log.info(`storage ready ${this._mainStorageFile}`)
  }

  get _mainAppDir(): string {
    return config.local.taskbookDirectory
  }

  _ensureDirectories() {
    ensureDir(this._mainAppDir)
    ensureDir(this._storageDir)
    ensureDir(this._archiveDir)
    ensureDir(this._tempDir)

    this._cleanTempDir()
  }

  _cleanTempDir() {
    const tempFiles = fs.readdirSync(this._tempDir).map((x) => join(this._tempDir, x))

    if (tempFiles.length !== 0) {
      tempFiles.forEach((tempFile) => fs.unlinkSync(tempFile))
    }
  }

  _getTempFile(filePath: string): string {
    const randomString = randomHexString()
    const tempFilename = basename(filePath).split('.').join(`.TEMP-${randomString}.`)

    return join(this._tempDir, tempFilename)
  }

  get(storageFile = this._mainStorageFile): Catalog {
    log.debug(`loading storage items from ${storageFile}`)
    let data = {}

    if (fs.existsSync(storageFile)) {
      const content = fs.readFileSync(storageFile, 'utf8')
      data = JSON.parse(content)
    }

    return parseJson(data)
  }

  getArchive(): Catalog {
    return this.get(this._archiveFile)
  }

  getBin(): Catalog {
    return this.get(this._binFile)
  }

  set(data: CatalogInnerData, storageFile = this._mainStorageFile) {
    log.info(`saving catalog to storage: ${storageFile}`)
    const serialized = JSON.stringify(data, null, 4)
    const tempStorageFile = this._getTempFile(storageFile)

    fs.writeFileSync(tempStorageFile, serialized, 'utf8')
    fs.renameSync(tempStorageFile, storageFile)
  }

  setArchive(data: CatalogInnerData) {
    this.set(data, this._archiveFile)
  }

  setBin(data: CatalogInnerData) {
    this.set(data, this._binFile)
  }
}

export default LocalJSONStorage
