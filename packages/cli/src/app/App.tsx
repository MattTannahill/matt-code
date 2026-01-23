import Anthropic from '@anthropic-ai/sdk';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient'
import TextInput from 'ink-text-input';
import OpenAI from 'openai';
import { useState } from 'react';
import { RED, ORANGE, YELLOW, BLUE } from './colors.js';
import LS from '../tools/ls.js';
import packageJson from '../../package.json' with { type: 'json' };

const logoGradient = [YELLOW, YELLOW, ORANGE];

type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type ConversationItem = {
  content: string;
  role: 'assistant' | 'user' | 'tool';
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: LS.toolName,
      description: LS.description,
      parameters: {
        type: 'object',
        properties: {
          args: {
            type: 'string',
            description: "Arguments to pass to the ls command (e.g., '-la' or a path).",
          },
        },
        required: [],
      },
    },
  },
];

type AppProps = {
  api: string;
};

export const App = ({ api }: AppProps) => {
  const client =
    api === 'anthropic'
      ? new Anthropic({
          apiKey: 'anthropic',
          baseURL: 'http://localhost:11434/v1',
        })
      : new OpenAI({
          apiKey: 'ollama',
          baseURL: 'http://localhost:11434/v1',
        });
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [message, setMessage] = useState('');

  const handleSubmit = async (value: string | ConversationItem) => {
    const newConversation: ConversationItem[] =
      typeof value === 'string'
        ? [...conversation, { content: value, role: 'user' }]
        : [...conversation, value];
    setConversation(newConversation);
    if (typeof value === 'string') {
      setMessage('');
    }

    const messages = newConversation.map(
      ({ role, content, tool_calls, tool_call_id }) => {
        if (tool_calls) {
          return {
            role,
            content,
            tool_calls: tool_calls.map(
              ({ id, function: { name, arguments: args } }) => ({
                id,
                type: 'function',
                function: { name, arguments: args },
              }),
            ),
          } as any;
        }
        if (tool_call_id) {
          return { role, content, tool_call_id } as any;
        }
        return { role, content } as any;
      },
    );

    const stream =
      api === 'anthropic'
        ? await (client as Anthropic).messages.stream({
            messages: messages.map(({ role, content }) => ({
              role: role === 'tool' ? 'user' : role,
              content,
            })) as any,
            model: 'qwen3-coder:30b',
            max_tokens: 1024,
          })
        : await (client as OpenAI).chat.completions.create({
            messages,
            model: 'qwen3-coder:30b',
            stream: true,
            tools,
            tool_choice: 'auto',
          });

    let assistantResponse = '';
    let toolCalls: ToolCall[] = [];

    if (api === 'anthropic') {
      for await (const event of stream as any) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          assistantResponse += event.delta.text;
          setConversation(prevConversation => {
            const lastMessage = prevConversation[prevConversation.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              const updatedLastMessage = {
                ...lastMessage,
                content: lastMessage.content + event.delta.text,
              };
              return [...prevConversation.slice(0, -1), updatedLastMessage];
            } else {
              return [
                ...prevConversation,
                { content: event.delta.text, role: 'assistant' },
              ];
            }
          });
        } else if (event.type === 'message_delta') {
          // Handle potential changes in stop reason, etc.
        }
      }
    } else {
      for await (const chunk of stream as any) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          assistantResponse += delta.content;
          setConversation(prevConversation => {
            const lastMessage = prevConversation.at(-1);
            if (
              !lastMessage ||
              lastMessage.role !== 'assistant'
            ) {
              return [
                ...prevConversation,
                { content: delta.content, role: 'assistant' },
              ];
            }
            const updatedLastMessage: ConversationItem = {
              ...lastMessage,
              content: lastMessage.content + delta.content,
            };
            return [...prevConversation.slice(0, -1), updatedLastMessage];
          });
        }

        if (delta?.tool_calls) {
          for (const newToolCall of delta.tool_calls) {
            if (newToolCall.index !== undefined) {
              const existingToolCall = toolCalls[newToolCall.index];
              if (existingToolCall) {
                // Append to existing tool call
                existingToolCall.function.arguments +=
                  newToolCall.function?.arguments || '';
              } else {
                // Add new tool call
                toolCalls[newToolCall.index] = {
                  id: newToolCall.id!,
                  type: 'function',
                  function: {
                    name: newToolCall.function!.name!,
                    arguments: newToolCall.function?.arguments || '',
                  },
                };
              }
            }
          }
        }
      }
    }

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const { name, arguments: args } = toolCall.function;
        if (name === LS.toolName) {
          try {
            const parsedArgs = JSON.parse(args);
            const toolOutput = await LS.run(parsedArgs.args);
            const toolMessage: ConversationItem = {
              role: 'tool',
              content: toolOutput,
              tool_call_id: toolCall.id,
            };
            await handleSubmit(toolMessage);
          } catch (error) {
            console.error('Error executing tool:', error);
            const errorMessage: ConversationItem = {
              role: 'tool',
              content: `Error: ${
                error instanceof Error ? error.message : String(error)
              }`,
              tool_call_id: toolCall.id,
            };
            await handleSubmit(errorMessage);
          }
        }
      }
    } else {
      if (assistantResponse) {
        setConversation(prev => [
          ...prev.slice(0, -1),
          { content: assistantResponse, role: 'assistant' },
        ]);
      }
    }
  };

  return (
    <Box flexDirection='column'>
      <Box marginX={2} marginBottom={1}>
        <Box flexDirection='column' marginRight={2}>
          {/* https://en.wikipedia.org/wiki/Block_Elements */}
          <Gradient colors={logoGradient}><Text>▀█ █       █ █▀</Text></Gradient>
          <Gradient colors={logoGradient}><Text> █  █     █  █ </Text></Gradient>
          <Gradient colors={logoGradient}><Text> █   █   █   █ </Text></Gradient>
          <Gradient colors={logoGradient}><Text>▄█    █ █    █▄</Text></Gradient>
        </Box>
        <Box flexDirection='column'>
          <Text bold color={BLUE}>MATT CODE</Text>
          <Text bold color={RED}>v{packageJson.version}</Text>
          {/* <Gradient colors={['#d83520', '#c82473', '#952052']}><Text>v{packageJson.version}</Text></Gradient> */}
        </Box>
      </Box>
      {conversation.map((item, index) => (
        <Box 
          key={index} 
          borderStyle={item.role === 'user' ? 'single' : undefined}
          borderColor={item.role === 'user' ? BLUE : undefined}  
          marginBottom={1} 
          paddingX={1}
        >
          <Box width={6}>
            <Text bold>
              {item.role === 'user'
                ? ']\\/['
                : item.role === 'tool'
                  ? 'Tool:'
                  : 'Bot:'}
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