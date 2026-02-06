import { Box, Static, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';

import packageJson from '../../package.json' with { type: 'json' };
import { Banner } from './banner.js';
import { BLUE, YELLOW } from './colors.js';
import { ConversationItem } from './conversation-item.js';
import { Session, SessionFactory } from './session.js';

type AppProps = {
  sessionFactory: SessionFactory;
};

const ConversationItemView = ({ item }: { item: ConversationItem }) => (
  <Box
    borderColor={item.role === 'user' ? BLUE : undefined}
    borderStyle={item.role === 'user' ? 'singleDouble' : undefined}
    marginBottom={1}
    paddingX={1}
    width={process.stdout.columns}
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
);

export const App = ({ sessionFactory }: AppProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [staticItems, setStaticItems] = useState<ConversationItem[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [bannerRendered, setBannerRendered] = useState(false);

  useEffect(() => {
    setBannerRendered(true);
    const init = async () => {
      try {
        const s = await sessionFactory.createSession();
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
    setIsRunning(true);
    try {
      await session.run(value, {
        onMessage: (item) => {
          setStaticItems(prev => [...prev, item]);
          setStreamingContent('');
        },
        onChunk: (chunk) => {
          setStreamingContent(prev => prev + chunk);
        }
      });
    } finally {
      setIsRunning(false);
    }
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
      <Box flexDirection="column">
        <Static items={bannerRendered ? [packageJson.version] : []}>
          {v => <Banner key="banner" packageVersion={v} />}
        </Static>
        <Box padding={1}>
          <Text italic>Loading...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Static items={bannerRendered ? [packageJson.version] : []}>
        {v => <Banner key="banner" packageVersion={v} />}
      </Static>
      <Static items={staticItems}>
        {(item, index) => <ConversationItemView key={index} item={item} />}
      </Static>
      
      {streamingContent && (
        <ConversationItemView item={{ role: 'assistant', content: streamingContent }} />
      )}

      <Box borderColor={YELLOW} borderStyle="singleDouble" paddingX={1}>
        <Box marginRight={2}>
          <Text color={YELLOW}>]\/[</Text>
        </Box>
        <Box>
          <TextInput
            onChange={setMessage}
            onSubmit={handleSubmit}
            placeholder="What would you like to do today?"
            value={message}
          />
        </Box>
      </Box>
    </Box>
  );
};
