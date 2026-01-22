import { Command } from '@oclif/core';
import { Box, render, Text } from 'ink';
import TextInput from 'ink-text-input';
import OpenAI from 'openai';
import React, { useState } from 'react';
import LS from '../tools/ls.js';

const ollama = new OpenAI({
  apiKey: 'ollama',
  baseURL: 'http://localhost:11434/v1',
});

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
            description: 'Arguments to pass to the ls command (e.g., "-la" or a path).',
          },
        },
        required: [],
      },
    },
  },
];

const App = () => {
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [message, setMessage] = useState('');

  const handleSubmit = async (value: string) => {
    const newConversation: ConversationItem[] = [
      ...conversation,
      { content: value, role: 'user' },
    ];
    setConversation(newConversation);
    setMessage('');

    const messages = newConversation.map(
      ({ role, content, tool_calls, tool_call_id }) => {
        if (tool_calls) {
          return {
            role,
            content,
            tool_calls: tool_calls.map(({ id, function: { name, arguments: args } }) => ({
              id,
              type: 'function',
              function: { name, arguments: args },
            })),
          } as any;
        }
        if (tool_call_id) {
          return { role, content, tool_call_id } as any;
        }
        return { role, content } as any;
      },
    );

    const stream = (await ollama.chat.completions.create({
      messages,
      model: 'qwen3-coder:30b',
      stream: true,
      tools,
      tool_choice: 'auto',
    } as any)) as any;

    let assistantResponse = '';
    let toolCalls: ToolCall[] = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        assistantResponse += delta.content;
        setConversation((prevConversation) => {
          const lastMessage = prevConversation.at(-1);
          if (
            !lastMessage ||
            (lastMessage.role !== 'assistant' && lastMessage.role !== 'tool')
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
            await handleSubmitFromTool(toolMessage);
          } catch (error) {
            console.error('Error executing tool:', error);
            const errorMessage: ConversationItem = {
              role: 'tool',
              content: `Error: ${error instanceof Error ? error.message : String(error)}`,
              tool_call_id: toolCall.id,
            };
            await handleSubmitFromTool(errorMessage);
          }
        }
      }
    } else {
      if (assistantResponse) {
        setConversation((prev) => [
          ...prev.slice(0, -1),
          { content: assistantResponse, role: 'assistant' },
        ]);
      }
    }
  };

  const handleSubmitFromTool = async (
    toolMessage: ConversationItem,
  ): Promise<void> => {
    const newConversation = [...conversation, toolMessage];
    setConversation(newConversation);

    const messages = newConversation.map(
      ({ role, content, tool_calls, tool_call_id }) => {
        if (tool_calls) {
          return {
            role,
            content,
            tool_calls: tool_calls.map(({ id, function: { name, arguments: args } }) => ({
              id,
              type: 'function',
              function: { name, arguments: args },
            })),
          } as any;
        }
        if (tool_call_id) {
          return { role, content, tool_call_id } as any;
        }
        return { role, content } as any;
      },
    );

    const stream = (await ollama.chat.completions.create({
      messages: messages,
      model: 'qwen3-coder:30b',
      stream: true,
      tools,
      tool_choice: 'auto',
    } as any)) as any;

    let assistantResponse = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        assistantResponse += delta.content;
        setConversation((prevConversation) => {
          const lastMessage = prevConversation.at(-1);
          if (
            !lastMessage ||
            (lastMessage.role !== 'assistant' && lastMessage.role !== 'tool')
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
    }

    if (assistantResponse) {
      setConversation((prev) => [
        ...prev.slice(0, -1),
        { content: assistantResponse, role: 'assistant' },
      ]);
    }
  };

  return (
    <Box flexDirection="column">
      {conversation.map((item, index) => (
        <Box flexDirection="column" key={index} marginBottom={1}>
          <Text bold>{item.role === 'user' ? 'You:' : item.role === 'tool' ? 'Tool:' : 'Bot:'}</Text>
          <Text>{item.content}</Text>
        </Box>
      ))}
      <Box>
        <Text>Enter your message: </Text>
        <TextInput
          onChange={setMessage}
          onSubmit={handleSubmit}
          value={message}
        />
      </Box>
    </Box>
  );
};

export default class UI extends Command {
  static override description = 'Open terminal UI';

  public async run(): Promise<void> {
    const { waitUntilExit } = render(<App />);
    return waitUntilExit();
  }
}
