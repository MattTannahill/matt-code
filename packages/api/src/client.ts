import { ConversationItem } from './conversation-item.js';
import { Tool } from './tool.js';

export interface Client {
  getConversation(): ConversationItem[];
  run(
    userMessage: string,
    tools: Tool[],
    callbacks: {
      executeTool: (name: string, args: string) => Promise<string>;
      onUpdate: () => void;
    },
  ): Promise<void>;
}
