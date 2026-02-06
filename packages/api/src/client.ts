import { Tool } from './tool.js';

export interface Client {
  run(
    userMessage: string,
    tools: Tool[],
    callbacks: {
      onToolCall: (name: string, args: string) => Promise<string>;
      onChunk?: (chunk: string) => void;
    },
  ): Promise<void>;
}
