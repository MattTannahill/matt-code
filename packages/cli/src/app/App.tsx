import {Config} from '@oclif/core'
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { Tool, ToolProvider } from 'matt-code-api';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { useEffect, useState } from 'react';

import packageJson from '../../package.json' with { type: 'json' };
import { Banner } from './Banner.js';
import { AnthropicClient } from './clients/anthropic-client.js';
import { OpenAIClient } from './clients/openai-client.js';
import { BLUE, YELLOW } from './colors.js';
import { Client } from './core/client.js';

type AppProps = {
  api?: 'anthropic' | 'openai';
  config: Config;
};

export const App = ({ api: apiProp, config }: AppProps) => {
  const api = apiProp ?? 'openai';
  const [tools, setTools] = useState<Tool[]>([]);

  useEffect(() => {
    const loadTools = async () => {
      const toolPromises = [...config.plugins.values()].map(async (plugin) => {
        try {
          const relativeEntryPoint = plugin.pjson.main || plugin.pjson.exports;
          if (!relativeEntryPoint) {
            return [];
          }

          const entryPoint = path.resolve(plugin.root, relativeEntryPoint);
          const url = pathToFileURL(entryPoint);
          const imported = await import(url.href);
          if (imported.toolProvider) {
            const provider = imported.toolProvider as ToolProvider;
            return await provider.fetch();
          }
        } catch (error) {
          console.error(`Error loading plugin ${plugin.name}:`, error);
        }

        return [];
      });

      const pluginTools = await Promise.all(toolPromises);
      setTools(pluginTools.flat());
    };

    loadTools();
  }, [config]);

  if (api !== 'openai' && api !== 'anthropic') {
    throw new Error(`Unknown API client: ${api}`);
  }

  const [client] = useState<Client>(() => api === 'anthropic' ? new AnthropicClient() : new OpenAIClient());
  const [, setRender] = useState(0);
  const [message, setMessage] = useState('');

  const onUpdate = () => {
    setRender(r => r + 1);
  };

  const handleSubmit = async (value: string) => {
    setMessage('');

    const executeTool = async (name: string, args: string) => {
      const tool = tools.find(t => t.name === name);
      if (!tool) {
        return `Error: Unknown tool ${name}`;
      }

      try {
        const parsedArgs = JSON.parse(args);
        return await tool.run(parsedArgs.command);
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

    await client.run(value, tools, { executeTool, onUpdate });
  };

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
