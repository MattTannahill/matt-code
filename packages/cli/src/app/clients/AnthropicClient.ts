import Anthropic from '@anthropic-ai/sdk';

import { Client } from '../core/Client.js';
import { ConversationItem } from '../core/ConversationItem.js';
import { MODEL_NAME } from '../config.js';
import { Tool } from 'matt-code-api';

export class AnthropicClient implements Client {
  private client: Anthropic;
  private messages: Anthropic.MessageParam[] = [];

  constructor() {
    this.client = new Anthropic({
      apiKey: 'ollama',
      baseURL: 'http://localhost:11434/v1',
    });
  }

  getConversation(): ConversationItem[] {
    const conversation: ConversationItem[] = [];
    for (const message of this.messages) {
      if (!message) continue;
      const {role} = message;
      const {content} = message;

      if (role === 'user') {
        if (typeof content === 'string') {
          conversation.push({ content, role: 'user' });
        } else if (Array.isArray(content)) {
          // tool results
          conversation.push({
            content: (content as Anthropic.ToolResultBlockParam[])
              .map(c => `Tool output for ${c.tool_use_id}:\n${c.content}`)
              .join('\n\n'),
            role: 'tool',
          });
        }
      } else if (role === 'assistant') {
        if (typeof content === 'string') {
          conversation.push({ content, role: 'assistant' });
        } else if (Array.isArray(content)) {
          const textPart = content.find(p => p.type === 'text');
          if (textPart) {
            conversation.push({ content: textPart.text, role: 'assistant' });
          }

          const toolParts = content.filter(p => p.type === 'tool_use');
          if (toolParts.length > 0) {
            conversation.push({
              content: toolParts
                .map(p => `Using tool: ${p.name}(${p.input})`)
                .join('\n'),
              role: 'assistant',
            });
          }
        } else {
          // null content during streaming
          conversation.push({ content: '', role: 'assistant' });
        }
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

    while (true) {
      const stream = await this.client.messages.create({
        max_tokens: 1024,
        messages: this.messages,
        model: MODEL_NAME,
        stream: true,
        tools: tools.map(tool => ({
          description: tool.description,
          input_schema: {
            ...tool.parameters,
            type: 'object' as const,
          },
          name: tool.name,
        })),
      });

      const assistantMessage: Anthropic.MessageParam = {
        content: null,
        role: 'assistant',
      };
      this.messages.push(assistantMessage);
      callbacks.onUpdate();

      let textContent = '';
      const toolUses: { id: string; input: string; name: string; type: 'tool_use' }[] = 
        [];
      let currentToolCall: null | { arguments: string; index: number; } = null;

      for await (const event of stream as any) {
        if (
          event.type === 'content_block_start' &&
          event.content_block.type === 'tool_use'
        ) {
          const toolUse = {
            id: event.content_block.id,
            input: '',
            name: event.content_block.name,
            type: 'tool_use' as const,
          };
          toolUses.push(toolUse);
          currentToolCall = { arguments: '', index: toolUses.length - 1 };
        } else if (event.type === 'content_block_delta') {
          if (
            event.delta.type === 'input_json_delta' &&
            currentToolCall !== null
          ) {
            currentToolCall.arguments += event.delta.partial_json;
            toolUses[currentToolCall.index].input = currentToolCall.arguments;
          } else if (event.delta.type === 'text_delta') {
            textContent += event.delta.text;
          }
        } else if (event.type === 'content_block_stop') {
          currentToolCall = null;
        }

        const contentParts: (
          | { id: string; input: string; name: string; type: 'tool_use' }
          | { text: string; type: 'text'; }
        )[] = [];
        if (textContent) contentParts.push({ text: textContent, type: 'text' });
        contentParts.push(...toolUses);

        if (contentParts.length === 0) {
          assistantMessage.content = null;
        } else if (contentParts.length === 1 && contentParts[0].type === 'text') {
          assistantMessage.content = contentParts[0].text;
        } else {
          assistantMessage.content = contentParts;
        }

        callbacks.onUpdate();
      }

      if (toolUses.length > 0) {
        const toolResponseContents = await Promise.all(
          toolUses.map(async toolCall => {
            const toolOutput = await callbacks.executeTool(
              toolCall.name,
              toolCall.input,
            );
            return {
              content: toolOutput,
              tool_use_id: toolCall.id,
              type: 'tool_result' as const,
            };
          }),
        );
        this.messages.push({
          content: toolResponseContents,
          role: 'user',
        });
        callbacks.onUpdate();
        // and loop...
      } else {
        break; // exit loop
      }
    }
  }
}
