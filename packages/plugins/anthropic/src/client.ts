import Anthropic from '@anthropic-ai/sdk';
import { Client, ConversationItem, Tool } from 'matt-code-api';

const MODEL_NAME = 'qwen3-coder:30b';

export class AnthropicClient implements Client {
  private client: Anthropic;
  private messages: Anthropic.MessageParam[] = [];

  constructor(options: Record<string, any> = {}) {
    this.client = new Anthropic(options);
  }

  async run(
    userMessage: string,
    tools: Tool[],
    callbacks: {
      onToolCall: (name: string, args: string) => Promise<string>;
      onChunk?: (chunk: string) => void;
    },
  ): Promise<void> {
    this.messages.push({ content: userMessage, role: 'user' });

    /* eslint-disable no-await-in-loop */
    while (true) {
      const stream = await this.client.messages.create({
        /* eslint-disable camelcase */
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
        /* eslint-enable camelcase */
      });

      const assistantMessage: Anthropic.MessageParam = {
        content: null,
        role: 'assistant',
      };
      this.messages.push(assistantMessage);

      let textContent = '';
      const toolUses: { id: string; input: string; name: string; type: 'tool_use' }[] = 
        [];
      let currentToolCall: null | { arguments: string; index: number; } = null;

      for await (const event of stream) {
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
            callbacks.onChunk?.(event.delta.text);
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
      }

      if (toolUses.length > 0) {
        const toolResponseContents = await Promise.all(
          toolUses.map(async toolCall => {
            const toolOutput = await callbacks.onToolCall(
              toolCall.name,
              toolCall.input,
            );
            return {
              content: toolOutput,
              /* eslint-disable-next-line camelcase */
              tool_use_id: toolCall.id,
              type: 'tool_result' as const,
            };
          }),
        );
        this.messages.push({
          content: toolResponseContents,
          role: 'user',
        });
        // and loop...
      } else {
        break;
      }
    }
  }
}
