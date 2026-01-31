import {Config} from '@oclif/core'
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { Client, ClientFactoryProvider, Tool, ToolProvider } from 'matt-code-api';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { useEffect, useState } from 'react';

import packageJson from '../../package.json' with { type: 'json' };
import { Banner } from './banner.js';
import { BLUE, YELLOW } from './colors.js';

type AppProps = {
  config: Config;
};

export const App = ({ config }: AppProps) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<null | string>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlugins = async () => {
      setLoading(true);
      setError(null);
      const loadedTools: Tool[] = [];
      let loadedClient: Client | null = null;
      let clientConfig: null | { config: Record<string, unknown>; id: string; } = null;

      try {
        const configPath = path.join(config.configDir, 'config.json');
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
        // Ignore error if config file doesn't exist, we will error later if no client is found
      }

      if (!clientConfig) {
        setError('No client configured. Please add a client to your config.json.');
        setLoading(false);
        return;
      }

      await Promise.all([...config.plugins.values()].map(async (plugin) => {
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
                 loadedClient = factories[tName].createClient(clientConfig.config.options);
               }
             }
          }
        } catch (error_) {
          console.error(`Error loading plugin ${plugin.name}:`, error_);
        }
      }));

      setTools(loadedTools);
      if (loadedClient) {
        setClient(loadedClient);
      } else {
        setError(`Could not find or create client of type: ${clientConfig.config.type}`);
      }
      setLoading(false);
    };

    loadPlugins();
  }, [config]);

  const [, setRender] = useState(0);
  const [message, setMessage] = useState('');

  const onUpdate = () => {
    setRender(r => r + 1);
  };

  const handleSubmit = async (value: string) => {
    if (!client) return;

    setMessage('');

    const executeTool = async (name: string, args: string) => {
      const tool = tools.find(t => t.name === name);
      if (!tool) {
        return `Error: Unknown tool ${name}`;
      }

      try {
        const parsedArgs = JSON.parse(args);
        return await tool.run(parsedArgs);
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

    await client.run(value, tools, { executeTool, onUpdate });
  };

  if (loading) {
    return (
      <Box padding={1}>
        <Text italic>Loading...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={1}>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (!client) {
    return (
      <Box padding={1}>
        <Text color="red">Error: Client initialization failed without a specific error message.</Text>
      </Box>
    );
  }

  const conversation = client.getConversation();

  return (
    <Box flexDirection='column'>
    <Banner packageVersion={packageJson.version} />
      {conversation.map((item, index) => (
        <Box 
          borderColor={item.role === 'user' ? BLUE : undefined} 
          borderStyle={item.role === 'user' ? 'singleDouble' : undefined}
          key={index}  
          marginBottom={1} 
          paddingX={1}
        >
          <Box width={item.role === 'user' ? 6 : 7}>
            <Text bold>
              {item.role === 'user'
                ? String.raw`]\/[`
                : item.role === 'tool'
                  ? 'Tool:'
                  : 'Model:'}
            </Text>
          </Box>
          <Box>
            <Text>{item.content}</Text>
          </Box>
        </Box>
      ))}
      <Box borderColor={YELLOW} borderStyle='singleDouble' paddingX={1}>
        <Box marginRight={2}>
          <Text color={YELLOW}>]\/[</Text>
        </Box>
        <Box>
          <TextInput
            onChange={setMessage}
            onSubmit={handleSubmit}
            placeholder='What would you like to do today?'
            value={message}
          />
        </Box>
      </Box>
    </Box>
  );
};
