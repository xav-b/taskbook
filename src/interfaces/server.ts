#!/usr/bin/env node

import { Command } from 'commander'
import net, { AddressInfo } from 'net'

import Taskbook from '../use_cases/taskbook'
import pkg from '../../package.json'

const debug = require('debug')('server:udp')

// TODO: cli option
const PORT = 2222

debug('instantiating commander')
const program = new Command()
debug('instantiating Taskbook')
const taskbook = new Taskbook()

interface TBCommand {
  command: 'check | clear'
  itemIds?: string[]
  arguments?: Record<string, string>
}

// default handler called when the command is not recognised
program
  .name(`Headless ${pkg.name}`)
  .description(pkg.description)
  .version(pkg.version)
  .action(() => {
    const server = net.createServer()

    server.on('connection', (conn) => {
      debug(`connection established from ${conn.remoteAddress}:${conn.remotePort}`)

      conn.setEncoding('utf8')
      conn.on('close', () => console.log('connection closed'))
      conn.on('error', (err) => console.error(`handler failed: ${err.message}`))

      conn.on('data', (message) => {
        // const _send = (_response: Record<string, any>) =>
        //   server.send(JSON.stringify(_response), remote.port, remote.address)

        const msg: TBCommand = JSON.parse(message.toString())
        debug('received command:', msg.command, msg.itemIds)

        // replicate command and aliases from cli
        if (['list', 'ls', 'l'].includes(msg.command)) {
          const attributes = (msg.arguments?.attributes || ['all']) as string[]
          const { data, groups } = taskbook.listByAttributes(attributes)

          conn.write(JSON.stringify({ catalog: data.toJSON(), groups }))
        }
      })
    })

    server.listen(PORT, () => {
      const { address, port } = server.address() as AddressInfo
      console.log(`listening on tcp://${address}:${port}...`)
    })
  })

program.parse()
