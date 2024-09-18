import fs from 'fs'
import path from 'path'

import config from '../config'
import Storage, { RawCatalog, RawIBullet } from '.'
import IBullet from '../domain/ibullet'
import Logger from '../shared/logger'
import { randomHexString, ensureDir } from '../shared/utils'

const { basename, join } = path

const log = Logger('store.json')

const DEFAULT_STORAGE = 'index'
const DEFAULT_WORKSPACE = 'default'
const TB_APP_DIRECTORY = config.local.taskbookDirectory

class LocalJSONStorage implements Storage {
  // local storage is all about directories and files
  _storageDir: string

  _tempDir: string

  // loading from disk is expensive. If we do it once, keep an internally
  // loaded version of it.
  _cache: Record<string, RawCatalog>

  constructor(workspace?: string) {
    this._cache = {}

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

  _storageFile(bucket: string): string {
    return join(this._storageDir, `${bucket}.json`)
  }

  all(bucket = DEFAULT_STORAGE): RawCatalog {
    if (this._cache[bucket]) return this._cache[bucket]

    // else load it
    const storageFile = this._storageFile(bucket)
    log.debug(`loading storage items from ${storageFile}`)
    let data = {}

    if (fs.existsSync(storageFile)) {
      const content = fs.readFileSync(storageFile, 'utf8')
      data = JSON.parse(content)
    }

    this._cache[bucket] = data

    return this._cache[bucket]
  }

  /**
   * In the case of filesystem storage, we simply flush to disk the entire
   * collection.
   * Which will effectively save the edits made so far to the internal cache
   * for that bucket.
   */
  commit(bucket = DEFAULT_STORAGE) {
    // retrieve our (likely dirty) cache
    const data = this.all(bucket)
    // where it will be saved
    const storageFile = this._storageFile(bucket)

    log.info(`saving catalog to storage: ${storageFile}`)
    const serialized = JSON.stringify(data, null, 4)
    const tempStorageFile = this._getTempFile(storageFile)

    fs.writeFileSync(tempStorageFile, serialized, 'utf8')
    fs.renameSync(tempStorageFile, storageFile)
  }

  get(key: string, bucket?: string): RawIBullet | null {
    return this.all(bucket)[key] || null
  }

  /**
   * Because every update need to re-dump the whole json file, we only update
   * the internal state, and will wait for `this.commit()`
   */
  upsert(item: IBullet, key?: string, bucket?: string): void {
    const data = this.all(bucket)
    const itemId = key ? parseInt(key, 10) : item.id
    // update our internal cache
    data[itemId] = item
  }

  /**
   * Same approach to delete.
   */
  delete(key: string, bucket?: string) {
    const data = this.all(bucket)

    // update internal cache
    delete data[key]
  }
}

export default LocalJSONStorage
