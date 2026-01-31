import {Args, Command} from '@oclif/core'
import * as fs from 'node:fs/promises'
import path from 'node:path'

export default class ClientsDestroy extends Command {
  static override args = {
    name: Args.string({description: 'Name of the client to destroy', required: true}),
  }
  static override description = 'Destroy a client configuration'

  public async run(): Promise<void> {
    const {args} = await this.parse(ClientsDestroy)

    const {configDir} = this.config

    const configPath = path.join(configDir, 'config.json')

    let configContent: {clients: Record<string, unknown>}

    try {
      const fileContent = await fs.readFile(configPath, 'utf8')
      configContent = JSON.parse(fileContent)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        this.error('Configuration file not found. No clients to destroy.')
      }
      throw error
    }

    if (!configContent.clients || !configContent.clients[args.name]) {
      this.error(`Client '${args.name}' not found.`)
    }

    delete configContent.clients[args.name]

    await fs.writeFile(configPath, JSON.stringify(configContent, null, 2))

    this.log(`Client '${args.name}' destroyed.`)
  }
}
