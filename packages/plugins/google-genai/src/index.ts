import { ClientFactory, ClientFactoryProvider } from 'matt-code-api';
import { z } from 'zod';
import { GoogleGenAIClient } from './client.js';

const googleGenAIFactory: ClientFactory = {
  optionsSchema: z.object({
    apiKey: z.string().optional(),
  }),
  createClient: (config) => new GoogleGenAIClient(config),
};

const clientProvider: ClientFactoryProvider = {
  fetch: async () => ({ "ai.models.generateContent": googleGenAIFactory }),
};

export default clientProvider;
