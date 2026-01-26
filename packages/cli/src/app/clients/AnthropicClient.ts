import Anthropic from '@anthropic-ai/sdk';
import { MODEL_NAME } from '../config.js';
import { Client } from '../api/Client.js';
import { ConversationItem } from '../api/ConversationItem.js';

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
      const role = message.role;
      const content = message.content;

      if (role === 'user') {
        if (typeof content === 'string') {
          conversation.push({ role: 'user', content });
        } else if (Array.isArray(content)) {
          // tool results
          conversation.push({
            role: 'tool',
            content: (content as Anthropic.ToolResultBlockParam[])
              .map(c => `Tool output for ${c.tool_use_id}:\n${c.content}`)
              .join('\n\n'),
          });
        }
      } else if (role === 'assistant') {
        if (typeof content === 'string') {
          conversation.push({ role: 'assistant', content });
        } else if (Array.isArray(content)) {
          const textPart = content.find(p => p.type === 'text');
          if (textPart) {
            conversation.push({ role: 'assistant', content: textPart.text });
          }
          const toolParts = content.filter(p => p.type === 'tool_use');
          if (toolParts.length > 0) {
            conversation.push({
              role: 'assistant',
              content: toolParts
                .map(p => `Using tool: ${p.name}(${p.input})`)
                .join('\n'),
            });
          }
        } else {
          // null content during streaming
          conversation.push({ role: 'assistant', content: '' });
        }
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
      const stream = await this.client.messages.create({
        messages: this.messages,
        model: MODEL_NAME,
        max_tokens: 1024,
        stream: true,
        tools: tools.map(tool => ({
          name: tool.toolName,
          description: tool.description,
          input_schema: {
            ...tool.parameters,
            type: 'object' as const,
          },
        })),
      });

      const assistantMessage: Anthropic.MessageParam = {
        role: 'assistant',
        content: null,
      };
      this.messages.push(assistantMessage);
      callbacks.onUpdate();

      let textContent = '';
      const toolUses: { id: string; name: string; input: string; type: 'tool_use' }[] = 
        [];
      let currentToolCall: { index: number; arguments: string } | null = null;

      for await (const event of stream as any) {
        if (
          event.type === 'content_block_start' &&
          event.content_block.type === 'tool_use'
        ) {
          const toolUse = {
            id: event.content_block.id,
            type: 'tool_use' as const,
            name: event.content_block.name,
            input: '',
          };
          toolUses.push(toolUse);
          currentToolCall = { index: toolUses.length - 1, arguments: '' };
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
          | { type: 'text'; text: string }
          | { id: string; name: string; input: string; type: 'tool_use' }
        )[] = [];
        if (textContent) contentParts.push({ type: 'text', text: textContent });
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
              type: 'tool_result' as const,
              tool_use_id: toolCall.id,
              content: toolOutput,
            };
          }),
        );
        this.messages.push({
          role: 'user',
          content: toolResponseContents,
        });
        callbacks.onUpdate();
        // and loop...
      } else {
        break; // exit loop
      }
    }
  }
}
