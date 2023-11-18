import fs from 'fs'
import path from 'path'

import config from '../config'
import Storage from '.'
import Task from '../domain/task'
import Note from '../domain/note'
import CalendarEvent from '../domain/event'
import Goal from '../domain/goal'
import Catalog, { CatalogInnerData } from '../domain/catalog'
import { randomHexString } from '../shared/utils'

const { basename, join } = path

function parseJson(data: any): Catalog {
  const catalog: CatalogInnerData = {}

  Object.keys(data).forEach((id: string) => {
    if (data[id]._type === 'task') catalog[id] = new Task(data[id])
    else if (data[id]._type === 'note') catalog[id] = new Note(data[id])
    else if (data[id]._type === 'event') catalog[id] = new CalendarEvent(data[id])
    else if (data[id]._type === 'goal') catalog[id] = new Goal(data[id])
    // TODO: proper rendering
    else console.log(`[warning] unknown item type: ${data[id]._type}`)
  })

  return new Catalog(catalog)
}

class LocalJSONStorage implements Storage {
  // local storage is all about directories and files
  _storageDir: string
  _archiveDir: string
  _tempDir: string
  _archiveFile: string
  _mainStorageFile: string

  constructor() {
    this._storageDir = join(this._mainAppDir, 'storage')
    this._archiveDir = join(this._mainAppDir, 'archive')
    this._tempDir = join(this._mainAppDir, '.temp')
    this._archiveFile = join(this._archiveDir, 'archive.json')
    this._mainStorageFile = join(this._storageDir, 'storage.json')

    this._ensureDirectories()
  }

  get _mainAppDir(): string {
    return config.get().taskbookDirectory
  }

  _ensureDir(directory: string) {
    if (!fs.existsSync(directory)) fs.mkdirSync(directory)
  }

  _ensureDirectories() {
    this._ensureDir(this._mainAppDir)
    this._ensureDir(this._storageDir)
    this._ensureDir(this._archiveDir)
    this._ensureDir(this._tempDir)

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

  set(data: CatalogInnerData, storageFile = this._mainStorageFile) {
    const serialized = JSON.stringify(data, null, 4)
    const tempStorageFile = this._getTempFile(storageFile)

    fs.writeFileSync(tempStorageFile, serialized, 'utf8')
    fs.renameSync(tempStorageFile, storageFile)
  }

  setArchive(data: CatalogInnerData) {
    this.set(data, this._archiveFile)
  }
}

export default LocalJSONStorage
