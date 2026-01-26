import OpenAI from 'openai';
import { MODEL_NAME } from '../config.js';
import { Client } from '../api/Client.js';
import { ConversationItem } from '../api/ConversationItem.js';

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
      if (message.role === 'user') {
        conversation.push({ role: 'user', content: message.content as string });
      } else if (message.role === 'assistant') {
        let content = message.content;
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
        conversation.push({ role: 'assistant', content });
      } else if (message.role === 'tool') {
        conversation.push({
          role: 'tool',
          content: `Tool output for ${message.tool_call_id}:\n${message.content}`,
        });
      }
    }
    return conversation;
  }

  async run(
    userMessage: string,
    tools: any[],
    callbacks: {
      onUpdate: () => void;
      executeTool: (name: string, args: string) => Promise<string>;
    },
  ): Promise<void> {
    this.messages.push({ role: 'user', content: userMessage });
    callbacks.onUpdate();

    while (true) {
      const stream = await this.client.chat.completions.create({
        messages: this.messages,
        model: MODEL_NAME,
        stream: true,
        tools: tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.toolName,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        tool_choice: 'auto',
      });

      const assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam =
        { role: 'assistant', content: null };
      this.messages.push(assistantMessage);
      callbacks.onUpdate();

      let textContent = '';
      const tempToolCalls: {
        id?: string;
        function: { name?: string; arguments: string };
      }[] = [];

      for await (const chunk of stream as any) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          textContent += delta.content;
          assistantMessage.content = textContent;
        }

        if (delta?.tool_calls) {
          assistantMessage.content = textContent;
          for (const newToolCall of delta.tool_calls) {
            if (newToolCall.index !== undefined) {
              if (!tempToolCalls[newToolCall.index]) {
                tempToolCalls[newToolCall.index] = {
                  function: { arguments: '' },
                };
              }
              if (newToolCall.id) {
                tempToolCalls[newToolCall.index].id = newToolCall.id;
              }
              if (newToolCall.function?.name) {
                tempToolCalls[newToolCall.index].function.name =
                  newToolCall.function.name;
              }
              if (newToolCall.function?.arguments) {
                tempToolCalls[newToolCall.index].function.arguments +=
                  newToolCall.function.arguments;
              }
            }
          }
          assistantMessage.tool_calls = tempToolCalls.map(tc => ({
            id: tc.id!,
            type: 'function',
            function: {
              name: tc.function.name!,
              arguments: tc.function.arguments,
            },
          }));
        }
        callbacks.onUpdate();
      }

      const finalToolCalls = tempToolCalls.map(tc => ({
        id: tc.id!,
        type: 'function' as const,
        function: {
          name: tc.function.name!,
          arguments: tc.function.arguments,
        },
      }));

      if (finalToolCalls.length > 0) {
        const toolResponses = await Promise.all(
          finalToolCalls.map(async toolCall => {
            const content = await callbacks.executeTool(
              toolCall.function.name,
              toolCall.function.arguments,
            );
            return {
              role: 'tool' as const,
              content,
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
}
