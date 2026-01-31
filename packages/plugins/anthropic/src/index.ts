import { ClientFactory, ClientFactoryProvider } from 'matt-code-api';
import { z } from 'zod';
import { AnthropicClient } from './client.js';

const anthropicFactory: ClientFactory = {
  optionsSchema: z.object({
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
  }),
  createClient: (config) => new AnthropicClient(config),
};

const clientProvider: ClientFactoryProvider = {
  fetch: async () => ({ "/v1/messages": anthropicFactory }),
};

export default clientProvider;
