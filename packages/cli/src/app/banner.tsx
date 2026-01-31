import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import React from 'react';

import { BLUE, ORANGE, RED, YELLOW } from './colors.js';

type BannerProps = {
  packageVersion: string;
};

const logoGradient = [YELLOW, YELLOW, ORANGE];

export const Banner: React.FC<BannerProps> = ({ packageVersion }) => (
  <Box marginBottom={1} marginX={2}>
    <Box flexDirection='column' marginRight={2}>
      {/* https://en.wikipedia.org/wiki/Block_Elements */}
      <Gradient colors={logoGradient}><Text>▀█ █       █ █▀</Text></Gradient>
      <Gradient colors={logoGradient}><Text> █  █     █  █ </Text></Gradient>
      <Gradient colors={logoGradient}><Text> █   █   █   █ </Text></Gradient>
      <Gradient colors={logoGradient}><Text>▄█    █ █    █▄</Text></Gradient>
    </Box>
    <Box flexDirection='column'>
      <Text bold color={BLUE}>MATT CODE</Text>
      <Text bold color={RED}>v{packageVersion}</Text>
      {/* <Gradient colors={['#d83520', '#c82473', '#952052']}><Text>v{packageJson.version}</Text></Gradient> */}
    </Box>
  </Box>
);
