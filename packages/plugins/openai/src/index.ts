import { ClientFactory, ClientFactoryProvider } from 'matt-code-api';
import { z } from 'zod';
import { OpenAIClient } from './client.js';

const openaiFactory: ClientFactory = {
  optionsSchema: z.object({
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
  }),
  createClient: (config) => new OpenAIClient(config),
};

const clientProvider: ClientFactoryProvider = {
  fetch: async () => ({ "/v1/chat/completions": openaiFactory }),
};

export default clientProvider;
