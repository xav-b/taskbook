import fs from 'fs'
import path from 'path'

import config from '../config'
import { randomHexString } from '../shared/utils'

const { basename, join } = path

class Storage {
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

  get() {
    let data = {}

    if (fs.existsSync(this._mainStorageFile)) {
      const content = fs.readFileSync(this._mainStorageFile, 'utf8')
      data = JSON.parse(content)
    }

    return data
  }

  getArchive() {
    let archive = {}

    if (fs.existsSync(this._archiveFile)) {
      const content = fs.readFileSync(this._archiveFile, 'utf8')
      archive = JSON.parse(content)
    }

    return archive
  }

  set(data: Record<string, any>) {
    const serialized = JSON.stringify(data, null, 4)
    const tempStorageFile = this._getTempFile(this._mainStorageFile)

    fs.writeFileSync(tempStorageFile, serialized, 'utf8')
    fs.renameSync(tempStorageFile, this._mainStorageFile)
  }

  setArchive(archive: Record<string, any>) {
    const data = JSON.stringify(archive, null, 4)
    const tempArchiveFile = this._getTempFile(this._archiveFile)

    fs.writeFileSync(tempArchiveFile, data, 'utf8')
    fs.renameSync(tempArchiveFile, this._archiveFile)
  }
}

export default new Storage()
