import {
  Content,
  FunctionDeclaration,
  FunctionResponse,
  GoogleGenAI,
  Part,
  Schema,
  Type,
} from '@google/genai';
import { Client, Tool } from 'matt-code-api';

// const MODEL_NAME = 'gemini-3-flash-preview';
const MODEL_NAME = 'gemini-2.5-flash';

export class GoogleGenAIClient implements Client {
  private client: GoogleGenAI;
  private history: Content[] = [];

  constructor(options: Record<string, any> = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    this.client = new GoogleGenAI({ apiKey });
  }

  async run(
    userMessage: string,
    tools: Tool[],
    callbacks: {
      onToolCall: (name: string, args: string) => Promise<string>;
      onChunk?: (chunk: string) => void;
    },
  ): Promise<void> {
    this.history.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    const functionDeclarations: FunctionDeclaration[] = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.mapSchema(tool.parameters),
    }));

    while (true) {
      const resultStream = await this.client.models.generateContentStream({
        model: MODEL_NAME,
        contents: this.history,
        config: {
          tools: [{ functionDeclarations }],
        },
      });

      const collectedParts: Part[] = [];
      const toolCallPromises: Promise<{ functionResponse: FunctionResponse }>[] = [];

      for await (const chunk of resultStream) {
        const candidate = chunk.candidates?.[0];
        if (!candidate) break;

        const parts = candidate.content?.parts;
        if (parts) {
          for (const part of parts) {
            collectedParts.push(part);
            if (part.text) {
              callbacks.onChunk?.(part.text);
            }
            if (part.functionCall) {
              const call = part.functionCall;
              const promise = callbacks.onToolCall(
                call.name,
                JSON.stringify(call.args),
              ).then(result => ({
                functionResponse: {
                  name: call.name,
                  response: { content: result },
                },
              }));
              toolCallPromises.push(promise);
            }
          }
        }
      }

      if (collectedParts.length > 0) {
        this.history.push({
          role: 'model',
          parts: collectedParts,
        });
      }

      if (toolCallPromises.length > 0) {
        const functionResponses = await Promise.all(toolCallPromises);
        this.history.push({
          role: 'user',
          parts: functionResponses,
        });
      } else {
        break;
      }
    }
  }

  private mapSchema(schema: any): Schema {
    if (!schema) return undefined as any;
    const newSchema: any = { ...schema };
    if (newSchema.type) {
      newSchema.type = Type[newSchema.type.toUpperCase() as keyof typeof Type];
    }
    if (newSchema.properties) {
      newSchema.properties = Object.fromEntries(
        Object.entries(newSchema.properties).map(([k, v]) => [k, this.mapSchema(v)])
      );
    }
    if (newSchema.items) {
      newSchema.items = this.mapSchema(newSchema.items);
    }
    return newSchema as Schema;
  }
}