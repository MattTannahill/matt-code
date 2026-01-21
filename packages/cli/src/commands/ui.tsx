import { Command } from '@oclif/core';
import { Box, render, Text } from 'ink';
import TextInput from 'ink-text-input';
import OpenAI from 'openai';
import React, { useState } from 'react';

const ollama = new OpenAI({
  apiKey: 'ollama',
  baseURL: 'http://localhost:11434/v1',
});

type ConversationItem = {
  role: 'user' | 'assistant';
  content: string;
};

const App = () => {
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [message, setMessage] = useState('');

  const handleSubmit = async (value: string) => {
    const newConversation: ConversationItem[] = [
      ...conversation,
      { role: 'user', content: value },
    ];
    setConversation(newConversation);
    setMessage('');

    const stream = await ollama.chat.completions.create({
      messages: newConversation,
      model: 'qwen3-coder:30b',
      stream: true,
    });

    setConversation([...newConversation, { role: 'assistant', content: '' }]);

    for await (const chunk of stream) {
      setConversation((prevConversation) => {
        const lastMessage = prevConversation[prevConversation.length - 1];
        const updatedLastMessage = {
          ...lastMessage,
          content:
            lastMessage.content + (chunk.choices[0]?.delta?.content ?? ''),
        };
        return [...prevConversation.slice(0, -1), updatedLastMessage];
      });
    }
  };

  return (
    <Box flexDirection="column">
      {conversation.map((item, index) => (
        <Box key={index} flexDirection="column" marginBottom={1}>
          <Text bold>{item.role === 'user' ? 'You:' : 'Bot:'}</Text>
          <Text>{item.content}</Text>
        </Box>
      ))}
      <Box>
        <Text>Enter your message: </Text>
        <TextInput
          onChange={setMessage}
          onSubmit={handleSubmit}
          value={message}
        />
      </Box>
    </Box>
  );
};

export default class UI extends Command {
  static override description = 'Open terminal UI';

  public async run(): Promise<void> {
    const { waitUntilExit } = render(<App />);
    return waitUntilExit();
  }
}
