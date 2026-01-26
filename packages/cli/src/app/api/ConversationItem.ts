export type ConversationItem = {
  content: string | null;
  role: 'assistant' | 'user' | 'tool';
};
