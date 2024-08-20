import fs from 'fs'
import path from 'path'
import { BinaryLike } from 'crypto'

import config from '../config'
import { ensureDir, sha256 } from '../shared/utils'

interface CacheOpts {
  path: string
  encoding?: BufferEncoding
}

/**
 * Emulate a simple key/value cache interface that persists its data between
 * processes, using the local file system.
 */
class LocalCache {
  rootPath: string

  encoding: BufferEncoding

  constructor(options: CacheOpts) {
    this.rootPath = options.path
    this.encoding = options.encoding || 'utf8'

    ensureDir(this.rootPath)
  }

  get(key: BinaryLike): string | null {
    const datumPath = path.join(this.rootPath, sha256(key))
    try {
      fs.accessSync(datumPath)
      return fs.readFileSync(datumPath, this.encoding)
    } catch (e) {
      return null
    }
  }

  set(key: BinaryLike, value: string) {
    const datumPath = path.join(this.rootPath, sha256(key))
    fs.writeFileSync(datumPath, value, 'utf8')
  }
}

function init(): LocalCache {
  const root = config.local.taskbookDirectory
  const storagePath = path.join(root, 'cache')
  return new LocalCache({ path: storagePath })
}

export default { init }
