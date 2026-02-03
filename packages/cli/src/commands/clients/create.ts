import {Args, Command, Flags} from '@oclif/core'
import * as fs from 'node:fs/promises'
import path from 'node:path'

export default class ClientsCreate extends Command {
  static override args = {
    name: Args.string({description: 'Name of the client', required: true}),
  }
  static override description = 'Create a new client configuration'
  static override flags = {
    options: Flags.string({char: 'o', description: 'Client options (JSON)', required: false}),
    type: Flags.string({char: 't', description: 'Type of the client (plugin:type)', required: true}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ClientsCreate)

    let parsedOptions: Record<string, unknown> = {}
    if (flags.options) {
      try {
        parsedOptions = JSON.parse(flags.options)
      } catch {
        this.error('Invalid JSON in options')
      }
    }

    if (!flags.type.includes(':')) {
      this.error('Type must be in the format plugin:type')
    }

    const [pluginName, clientType] = flags.type.split(':')

    const plugin = [...this.config.plugins.values()].find(p => p.name === pluginName || p.name === `matt-code-${pluginName}`)
    if (!plugin) {
      this.error(`Plugin '${pluginName}' not found`)
    }

    let module
    try {
      module = await import(plugin.name)
    } catch (error: unknown) {
      this.error(`Could not load plugin '${pluginName}': ${error}`)
    }

    const provider = module.default

    if (!provider || typeof provider.fetch !== 'function') {
      this.error(`Plugin '${pluginName}' does not provide a ClientFactoryProvider`)
    }

    const factories = await provider.fetch()

    if (!factories[clientType]) {
      this.error(`Plugin '${pluginName}' does not support client type '${clientType}'. Available types: ${Object.keys(factories).join(', ')}`)
    }

    const factory = factories[clientType]
    if (factory.optionsSchema) {
      try {
        parsedOptions = factory.optionsSchema.parse(parsedOptions)
      } catch (error) {
        if (error instanceof Error) {
          this.error(`Invalid configuration: ${error.message}`)
        }
        this.error('Invalid configuration')
      }
    }

    const {configDir} = this.config

    const configPath = path.join(configDir, 'config.json')

    // Ensure config directory exists
    await fs.mkdir(configDir, {recursive: true})

    let configContent: {clients: Record<string, unknown>} = {clients: {}}

    try {
      const fileContent = await fs.readFile(configPath, 'utf8')
      configContent = JSON.parse(fileContent)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        throw error
      }
      // If file doesn't exist, we use the default empty config
    }

    if (!configContent.clients) {
      configContent.clients = {}
    }

    if (configContent.clients[args.name]) {
      this.error(`Client '${args.name}' already exists`)
    }

    configContent.clients[args.name] = {
      options: parsedOptions,
      type: flags.type,
    }

    // Alphabetize clients by name
    const sortedClients: Record<string, unknown> = {}
    for (const key of Object.keys(configContent.clients).sort()) {
      sortedClients[key] = configContent.clients[key]
    }
    configContent.clients = sortedClients

    await fs.writeFile(configPath, JSON.stringify(configContent, null, 2))

    this.log(`Client '${args.name}' created.`)
  }
}
