import { Client, ConversationItem, Tool } from 'matt-code-api';
import OpenAI from 'openai';

const MODEL_NAME = 'qwen3-coder:30b';

export class OpenAIClient implements Client {
  private client: OpenAI;
  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  constructor(options: Record<string, any> = {}) {
    this.client = new OpenAI(options);
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
          callbacks.onChunk?.(delta.content);
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
            const content = await callbacks.onToolCall(
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
