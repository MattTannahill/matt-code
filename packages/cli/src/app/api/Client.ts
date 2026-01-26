import { ConversationItem } from './ConversationItem.js';

export interface Client {
  getConversation(): ConversationItem[];
  run(
    userMessage: string,
    tools: any[],
    callbacks: {
      onUpdate: () => void;
      executeTool: (name: string, args: string) => Promise<string>;
    },
  ): Promise<void>;
}
