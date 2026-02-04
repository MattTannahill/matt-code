import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';

import packageJson from '../../package.json' with { type: 'json' };
import { Banner } from './banner.js';
import { BLUE, YELLOW } from './colors.js';
import { Session, SessionFactory } from './session.js';

type AppProps = {
  sessionFactory: SessionFactory;
};

export const App = ({ sessionFactory }: AppProps) => {
  const [, setRender] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const s = await sessionFactory.createSession({
          onUpdate: () => setRender(r => r + 1)
        });
        setSession(s);
      } catch (e: any) {
        setError(e.message || String(e));
      }
    };
    init();
  }, []);

  const handleSubmit = async (value: string) => {
    if (!session) return;
    setMessage('');
    await session.run(value);
  };

  if (error) {
    return (
      <Box padding={1}>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (!session) {
    return (
      <Box padding={1}>
        <Text italic>Loading...</Text>
      </Box>
    );
  }

  const conversation = session.getConversation();

  return (
    <Box flexDirection='column'>
    <Banner packageVersion={packageJson.version} />
      {conversation.map((item, index) => (
        <Box 
          borderColor={item.role === 'user' ? BLUE : undefined} 
          borderStyle={item.role === 'user' ? 'singleDouble' : undefined}
          key={index}  
          marginBottom={1} 
          paddingX={1}
        >
          <Box width={item.role === 'user' ? 6 : 7}>
            <Text bold>
              {item.role === 'user'
                ? String.raw`]\/[`
                : item.role === 'tool'
                  ? 'Tool:'
                  : 'Model:'}
            </Text>
          </Box>
          <Box>
            <Text>{item.content}</Text>
          </Box>
        </Box>
      ))}
      <Box borderColor={YELLOW} borderStyle='singleDouble' paddingX={1}>
        <Box marginRight={2}>
          <Text color={YELLOW}>]\/[</Text>
        </Box>
        <Box>
          <TextInput
            onChange={setMessage}
            onSubmit={handleSubmit}
            placeholder='What would you like to do today?'
            value={message}
          />
        </Box>
      </Box>
    </Box>
  );
};
