import fs from 'fs'
import tmp from 'tmp'
import childProcess from 'child_process'

import config from '../../config'
import IBullet from '../../domain/ibullet'
import { Maybe } from '../../types'

const { editorCommand } = config.local

function read(item: IBullet): Maybe<string> {
  if (!item.comment) return null

  return Buffer.from(item.comment, 'base64').toString('ascii')
}

function encode(content: string) {
  return Buffer.from(content).toString('base64')
}

function decode(content: string) {
  return Buffer.from(content, 'base64').toString('ascii')
}

function initialContent(item: IBullet): string {
  if (item.comment)
    // initialise the file with the existing comment
    return decode(item.comment)

  // else bootstrap it
  let initContent = `# ID ${item.id} - ${item.description}

> _write content here..._
`
  if (item.link) initContent += `\n🔗 [Resource](${item.link})\n`

  return initContent
}

function write(item: IBullet, content?: string): string {
  // if we already have content just give it back in the right (base64 format)
  if (content) return encode(content)

  // else use a temporary file to write and encode back the content
  const tmpFile = tmp.fileSync({ mode: 0o644, prefix: 'taskbook-', postfix: '.md' })

  const initContent = initialContent(item)

  fs.writeFileSync(tmpFile.fd, initContent)

  childProcess.spawnSync(editorCommand, [`${tmpFile.name}`], { stdio: 'inherit' })
  // TODO: handle child error
  const comment = fs.readFileSync(tmpFile.name, 'utf8').trim()

  return encode(comment)
}

export default { write, read }
