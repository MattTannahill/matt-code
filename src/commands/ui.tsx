import { Command } from '@oclif/core';
import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import TextInput from 'ink-text-input';

const App = () => {
  const [message, setMessage] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState('');

  const handleSubmit = (value: string) => {
    setSubmittedMessage(value);
  };

  return (
    <Box>
      {submittedMessage ? (
        <Text>You entered: {submittedMessage}</Text>
      ) : (
        <Box>
          <Text>Enter your message: </Text>
          <TextInput value={message} onChange={setMessage} onSubmit={handleSubmit} />
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
