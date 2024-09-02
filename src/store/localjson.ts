import fs from 'fs'
import path from 'path'

import config from '../config'
import Storage, { mapFromJson } from '.'
import Catalog, { CatalogInnerData } from '../domain/catalog'
import Logger from '../shared/logger'
import { randomHexString, ensureDir } from '../shared/utils'

const { basename, join } = path

const log = Logger()

const DEFAULT_STORAGE = 'index'
const DEFAULT_WORKSPACE = 'default'
const TB_APP_DIRECTORY = config.local.taskbookDirectory

class LocalJSONStorage implements Storage {
  // local storage is all about directories and files
  _storageDir: string

  _tempDir: string

  constructor(workspace?: string) {
    // applying the default there as callers may explicitely pass a `null` or
    // `undefined`
    workspace = workspace || DEFAULT_WORKSPACE

    log.info(`initialising workspace storage ${workspace}`)

    this._storageDir = join(TB_APP_DIRECTORY, workspace, 'storage')
    // poor-man-atomic-writes: they are first written to a temporary file,
    // and that file is moved (committed!) to the actual storage
    this._tempDir = join(TB_APP_DIRECTORY, workspace, '.temp')

    this._ensureDirectories()

    log.info(`storage ready ${this._storageDir}`)
  }

  _ensureDirectories() {
    ensureDir(TB_APP_DIRECTORY)
    ensureDir(this._storageDir)
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

  _storageFile(scope: string): string {
    return join(this._storageDir, `${scope}.json`)
  }

  get(scope = DEFAULT_STORAGE): Catalog {
    const storageFile = this._storageFile(scope)
    log.debug(`loading storage items from ${storageFile}`)
    let data = {}

    if (fs.existsSync(storageFile)) {
      const content = fs.readFileSync(storageFile, 'utf8')
      data = JSON.parse(content)
    }

    return mapFromJson(data)
  }

  set(data: CatalogInnerData, scope = DEFAULT_STORAGE) {
    const storageFile = this._storageFile(scope)

    log.info(`saving catalog to storage: ${storageFile}`)
    const serialized = JSON.stringify(data, null, 4)
    const tempStorageFile = this._getTempFile(storageFile)

    fs.writeFileSync(tempStorageFile, serialized, 'utf8')
    fs.renameSync(tempStorageFile, storageFile)
  }
}

export default LocalJSONStorage
