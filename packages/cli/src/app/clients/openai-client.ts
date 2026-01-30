import { Tool } from 'matt-code-api';
import OpenAI from 'openai';

import { MODEL_NAME } from '../config.js';
import { Client } from '../core/client.js';
import { ConversationItem } from '../core/conversation-item.js';

export class OpenAIClient implements Client {
  private client: OpenAI;
  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  constructor() {
    this.client = new OpenAI({
      apiKey: 'ollama',
      baseURL: 'http://localhost:11434/v1',
    });
  }

  getConversation(): ConversationItem[] {
    const conversation: ConversationItem[] = [];
    for (const message of this.messages) {
      switch (message.role) {
      case 'assistant': {
        let {content} = message;
        if (Array.isArray(content)) {
          content = content
            .map(c => {
              if (c.type === 'text') return c.text;
              return '';
            })
            .join('');
        }

        content = content || '';

         
        if (message.tool_calls) {
          const toolCallContent = message.tool_calls
            .map(tc => {
              if (tc.type === 'function') {
                return `Using tool: ${tc.function.name}(${tc.function.arguments})`;
              }

              return `Using tool: ${tc.type}`;
            })
            .join('\n');
          if (typeof content === 'string') {
            content += '\n' + toolCallContent;
          } else {
            content = toolCallContent;
          }
        }
         

        conversation.push({ content, role: 'assistant' });
      
      break;
      }

      case 'tool': {
        conversation.push({
           
          content: `Tool output for ${message.tool_call_id}:\n${message.content}`,
          role: 'tool',
        });
      
      break;
      }

      case 'user': {
        conversation.push({ content: message.content as string, role: 'user' });
      
      break;
      }
      // No default
      }
    }

    return conversation;
  }

  async run(
    userMessage: string,
    tools: Tool[],
    callbacks: {
      executeTool: (name: string, args: string) => Promise<string>;
      onUpdate: () => void;
    },
  ): Promise<void> {
    this.messages.push({ content: userMessage, role: 'user' });
    callbacks.onUpdate();

    /* eslint-disable no-await-in-loop */
    while (true) {
      const stream = await this.client.chat.completions.create({
        messages: this.messages,
        model: MODEL_NAME,
        stream: true,
        /* eslint-disable-next-line camelcase */
        tool_choice: 'auto',
        tools: tools.map(tool => ({
          function: {
            description: tool.description,
            name: tool.name,
            parameters: tool.parameters,
          },
          type: 'function',
        })),
      });

      const assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam =
        { content: null, role: 'assistant' };
      this.messages.push(assistantMessage);
      callbacks.onUpdate();

      let textContent = '';
      const toolCallStreams: {
        function: { arguments: string; name?: string; };
        id?: string;
      }[] = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          textContent += delta.content;
          assistantMessage.content = textContent;
        }

        if (delta?.tool_calls) {
          assistantMessage.content = textContent;
          this.updateToolCallStreams(toolCallStreams, delta.tool_calls);

          /* eslint-disable-next-line camelcase */
          assistantMessage.tool_calls = toolCallStreams.map(tc => ({
            function: {
              arguments: tc.function.arguments,
              name: tc.function.name!,
            },
            id: tc.id!,
            type: 'function',
          }));
        }

        callbacks.onUpdate();
      }

      const finalToolCalls = toolCallStreams.map(tc => ({
        function: {
          arguments: tc.function.arguments,
          name: tc.function.name!,
        },
        id: tc.id!,
        type: 'function' as const,
      }));

      if (finalToolCalls.length > 0) {
        const toolResponses = await Promise.all(
          finalToolCalls.map(async toolCall => {
            const content = await callbacks.executeTool(
              toolCall.function.name,
              toolCall.function.arguments,
            );
            return {
              content,
              role: 'tool' as const,
              /* eslint-disable-next-line camelcase */
              tool_call_id: toolCall.id,
            };
          }),
        );
        this.messages.push(...toolResponses);
        callbacks.onUpdate();
        // Continue the loop to send tool responses back to the model
      } else {
        // No more tool calls, so we can exit the loop
        break;
      }
    }
  }

  private updateToolCallStreams(
    toolCallStreams: {
      function: { arguments: string; name?: string; };
      id?: string;
    }[],
    newToolCalls: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[],
  ) {
    for (const newToolCall of newToolCalls) {
      const { index } = newToolCall;
      if (index === undefined) continue;

      if (!toolCallStreams[index]) {
        toolCallStreams[index] = {
          function: { arguments: '' },
        };
      }

      if (newToolCall.id) {
        toolCallStreams[index].id = newToolCall.id;
      }

      if (newToolCall.function?.name) {
        toolCallStreams[index].function.name = newToolCall.function.name;
      }

      if (newToolCall.function?.arguments) {
        toolCallStreams[index].function.arguments += newToolCall.function.arguments;
      }
    }
  }
}
