import { Config } from '@oclif/core';
import { Client, ClientFactoryProvider, Tool, ToolProvider } from 'matt-code-api';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ConversationItem } from './conversation-item.js';

export type SessionRunCallbacks = {
  onMessage: (item: ConversationItem) => void;
  onChunk: (chunk: string) => void;
};

export class Session {
  constructor(
    private client: Client,
    private tools: Tool[]
  ) {}

  async run(input: string, callbacks: SessionRunCallbacks) {
    const { onMessage, onChunk } = callbacks;

    // User Message
    onMessage({ content: input, role: 'user' });

    let assistantContent = '';

    const flushAssistant = () => {
      if (assistantContent) {
        onMessage({ content: assistantContent, role: 'assistant' });
        assistantContent = '';
      }
    };

    const executeTool = async (name: string, args: string) => {
      flushAssistant();
      
      onMessage({ content: `Calling ${name} (args: ${args})`, role: 'tool' });

      const tool = this.tools.find(t => t.name === name);
      if (!tool) {
        const errorMsg = `Error: Unknown tool ${name}`;
        onMessage({ content: errorMsg, role: 'tool' });
        return errorMsg;
      }

      try {
        const parsedArgs = JSON.parse(args);
        const result = await tool.run(parsedArgs);
        onMessage({ content: result, role: 'tool' });
        return result;
      } catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
        onMessage({ content: errorMsg, role: 'tool' });
        return errorMsg;
      }
    };

    await this.client.run(input, this.tools, { 
      onToolCall: executeTool, 
      onChunk: (chunk) => {
        assistantContent += chunk;
        onChunk(chunk);
      } 
    });

    flushAssistant();
  }
}

export class SessionFactory {
  constructor(private config: Config) {}

  async createSession(): Promise<Session> {
    const loadedTools: Tool[] = [];
    let loadedClient: Client | null = null;
    let clientConfig: null | { config: Record<string, unknown>; id: string; } = null;

    try {
      const configPath = path.join(this.config.configDir, 'config.json');
      const fileContent = await fs.readFile(configPath, 'utf8');
      const json = JSON.parse(fileContent);
      
      if (json.clients) {
        const clientNames = Object.keys(json.clients);
        if (clientNames.length > 0) {
          const id = clientNames[0];
          clientConfig = { config: json.clients[id], id };
        }
      }
    } catch {
      // Ignore error if config file doesn't exist
    }

    if (!clientConfig) {
      throw new Error('No client configured. Please add a client to your config.json.');
    }

    await Promise.all([...this.config.plugins.values()].map(async (plugin) => {
      try {
        const relativeEntryPoint = plugin.pjson.main || plugin.pjson.exports;
        if (!relativeEntryPoint) return;

        const entryPoint = path.resolve(plugin.root, relativeEntryPoint);
        const url = pathToFileURL(entryPoint);
        const imported = await import(url.href);

        if (imported.toolProvider) {
          const provider = imported.toolProvider as ToolProvider;
          const fetchedTools = await provider.fetch();
          loadedTools.push(...fetchedTools);
        }

        if (imported.default && imported.default.fetch && clientConfig) {
           const provider = imported.default as ClientFactoryProvider;
           const factories = await provider.fetch();

           const { type } = clientConfig.config;
           if (typeof type === 'string') {
             const [pName, tName] = type.split(':');
             if ((plugin.name === pName || plugin.name === `matt-code-${pName}`) && factories[tName]) {
               const options = (clientConfig.config.options as Record<string, any>) ?? {};
               loadedClient = factories[tName].createClient(options);
             }
           }
        }
      } catch (error_) {
        console.error(`Error loading plugin ${plugin.name}:`, error_);
      }
    }));

    if (!loadedClient) {
      throw new Error(`Could not find or create client of type: ${clientConfig.config.type}`);
    }

    return new Session(loadedClient, loadedTools);
  }
}