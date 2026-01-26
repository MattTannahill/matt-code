import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';
import { AnthropicClient } from './clients/AnthropicClient.js';
import { Client } from './api/Client.js';
import { ConversationItem } from './api/ConversationItem.js';
import { OpenAIClient } from './clients/OpenAIClient.js';
import { BLUE, YELLOW } from './colors.js';
import BashTool from '../tools/bash.js';
import packageJson from '../../package.json' with { type: 'json' };
import { Banner } from './Banner.js';

const tools = [BashTool];

type AppProps = {
  api?: 'openai' | 'anthropic';
};

export const App = ({ api: apiProp }: AppProps) => {
  const api = apiProp ?? 'openai';

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
      const tool = tools.find(t => t.toolName === name);
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

    await client.run(value, tools, { onUpdate, executeTool });
  };

  const conversation = client.getConversation();

  return (
    <Box flexDirection='column'>
    <Banner packageVersion={packageJson.version} />
      {conversation.map((item, index) => (
        <Box 
          key={index} 
          borderStyle={item.role === 'user' ? 'single' : undefined}
          borderColor={item.role === 'user' ? BLUE : undefined}  
          marginBottom={1} 
          paddingX={1}
        >
          <Box width={item.role === 'user' ? 6 : 7}>
            <Text bold>
              {item.role === 'user'
                ? ']\\/['
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
      <Box borderStyle='singleDouble' borderColor={YELLOW} paddingX={1}>
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
