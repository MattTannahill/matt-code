import {Command} from '@oclif/core'
import {printTable} from '@oclif/table'
import * as fs from 'node:fs/promises'
import path from 'node:path'

export default class ClientsList extends Command {
  static override description = 'List configured clients'
  static override enableJsonFlag = true

  public async run(): Promise<unknown> {
    await this.parse(ClientsList)

    const {configDir} = this.config
    const configPath = path.join(configDir, 'config.json')

    let clients: {name: string; options: Record<string, unknown>; type: string}[] = []

    try {
      const fileContent = await fs.readFile(configPath, 'utf8')
      const configContent = JSON.parse(fileContent) as {clients?: Record<string, {options?: Record<string, unknown>; type?: string}>}

      if (configContent.clients) {
        clients = Object.entries(configContent.clients).map(([name, config]) => ({
          name,
          options: config.options || {},
          type: config.type || 'unknown',
        }))
      }
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
    }

    if (!this.jsonEnabled()) {
      printTable({
        borderStyle: 'none',
        columns: [
          {key: 'name', name: 'NAME'},
          {key: 'type', name: 'TYPE'},
          {key: 'displayOptions', name: 'OPTIONS', overflow: 'wrap'},
        ],
        data: clients.map(c => ({
          ...c,
          displayOptions: JSON.stringify(c.options, null, 2),
        })),
        maxWidth: 'none',
        padding: 2,
        trimWhitespace: false,
      })
    }

    return clients
  }
}
