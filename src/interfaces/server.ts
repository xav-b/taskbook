#!/usr/bin/env node

import { Command } from 'commander'
import net, { AddressInfo } from 'net'

import Taskbook from '../use_cases/taskbook'
import render from './render'
import Logger from '../shared/logger'
import pkg from '../../package.json'

const log = Logger('ui.server', true)

// TODO: cli option
const PORT = 2222

const program = new Command()
log.debug('instantiating Taskbook')
const taskbook = new Taskbook()

interface TBCommand {
  // TODO: supported command: 'ping | check | clear'
  command: string
  itemIds?: string[]
  arguments?: Record<string, string>
}

async function displayBoard(attributes: string[]) {
  // could be headless
  if (attributes.length === 0) return

  // TODO: clear the screen

  // pull the relevant data
  const { data, groups } = await taskbook.listByAttributes(attributes)
  const stats = data.stats()
  const tasksGrouped = data.groupByBoards(groups)

  // display
  render.displayByBoard(tasksGrouped, true)
  render.displayStats(stats)
}

// default handler called when the command is not recognised
program
  .name(`Headless ${pkg.name}`)
  .description(pkg.description)
  .argument('[attributes...]')
  .version(pkg.version)
  .action(async (attributes: string[]) => {
    const server = net.createServer()

    // display the initial version
    await displayBoard(attributes)

    server.on('connection', (conn) => {
      log.info(`connection established from ${conn.remoteAddress}:${conn.remotePort}`)

      conn.setEncoding('utf8')
      conn.on('close', () => log.info('connection closed'))
      conn.on('error', (err) => log.error(`handler failed: ${err.message}`))

      conn.on('data', async (message) => {
        const msg: TBCommand = JSON.parse(message.toString())
        log.debug('received command:', msg.command, msg.itemIds)

        // replicate command and aliases from cli
        if (msg.command === 'ping') {
          conn.write('pong')
        } else if (['list', 'ls', 'l'].includes(msg.command)) {
          const attributes = (msg.arguments?.attributes || ['all']) as string[]
          const { data, groups } = await taskbook.listByAttributes(attributes)

          conn.write(JSON.stringify({ catalog: data.toJSON(), groups }))
        }

        // TODO: if `attributes` were affected, re-write
        // TODO: clear the screen first
        displayBoard(attributes)
      })
    })

    server.listen(PORT, () => {
      const { address, port } = server.address() as AddressInfo
      log.info(`listening on tcp://${address}:${port}...`)
    })
  })

program.parse()
