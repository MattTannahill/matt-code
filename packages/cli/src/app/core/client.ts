import { Tool } from 'matt-code-api';

import { ConversationItem } from './conversation-item.js';

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
