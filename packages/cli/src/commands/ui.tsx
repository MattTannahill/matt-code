import { Command } from '@oclif/core';
import { Box, render, Text } from 'ink';
import TextInput from 'ink-text-input';
import OpenAI from 'openai';
import React, { useState } from 'react';

const ollama = new OpenAI({
  apiKey: 'ollama',
  baseURL: 'http://localhost:11434/v1',
});

const App = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');

  const handleSubmit = async (value: string) => {
    const stream = await ollama.chat.completions.create({
      messages: [{ content: value, role: 'user' }],
      model: 'qwen3-coder:30b',
      stream: true,
    });

    for await (const chunk of stream) {
      setResponse(
        (prev) => prev + (chunk.choices[0]?.delta?.content ?? ''),
      );
    }
  };

  return (
    <Box>
      {response ? (
        <Text>{response}</Text>
      ) : (
        <Box>
          <Text>Enter your message: </Text>
          <TextInput onChange={setMessage} onSubmit={handleSubmit} value={message} />
        </Box>
      )}
    </Box>
  );
};

export default class UI extends Command {
  static override description = 'Open a React Ink UI to ask for a message and echo it back.';

  public async run(): Promise<void> {
    const { waitUntilExit } = render(<App />);
    return waitUntilExit();
  }
}
