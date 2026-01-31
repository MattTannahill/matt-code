import { ZodType } from 'zod';
import { Client } from './client.js';

export interface ClientFactory {
  createClient(config: Record<string, any>): Client;
  optionsSchema?: ZodType<any>;
}

export interface ClientFactoryProvider {
  fetch: () => Promise<Record<string, ClientFactory>>;
}
