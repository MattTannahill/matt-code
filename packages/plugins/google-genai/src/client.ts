import {
  GoogleGenAI,
  FunctionDeclaration,
  Content,
  Type,
  Schema,
} from '@google/genai';
import { Client, ConversationItem, Tool } from 'matt-code-api';

const MODEL_NAME = 'gemini-2.5-flash';

export class GoogleGenAIClient implements Client {
  private client: GoogleGenAI;
  private history: Content[] = [];

  constructor(options: Record<string, any> = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    this.client = new GoogleGenAI({ apiKey });
  }

  getConversation(): ConversationItem[] {
    return this.history.map(item => {
      const part = item.parts?.[0];
      if (!part) return { role: 'user', content: '' };

      if (part.text !== undefined) {
        return {
          role: item.role === 'model' ? 'assistant' : 'user',
          content: part.text,
        };
      }

      if (part.functionCall) {
        return {
          role: 'assistant',
          content: `Using tool: ${part.functionCall.name}(${JSON.stringify(part.functionCall.args)})`,
        };
      }

      if (part.functionResponse) {
        return {
          role: 'tool',
          content: typeof part.functionResponse.response === 'string' 
            ? part.functionResponse.response 
            : JSON.stringify(part.functionResponse.response?.content),
        };
      }

      return { role: 'user', content: '' };
    });
  }

  async run(
    userMessage: string,
    tools: Tool[],
    callbacks: {
      executeTool: (name: string, args: string) => Promise<string>;
      onUpdate: () => void;
    },
  ): Promise<void> {
    this.history.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });
    callbacks.onUpdate();

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

      let text = '';
      let functionCall: any | undefined;

      // Temporary placeholder for streaming updates
      const tempHistoryItemIndex = this.history.length;
      this.history.push({ role: 'model', parts: [{ text: '' }] });

      for await (const chunk of resultStream) {
        const functionCalls = chunk.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
          functionCall = functionCalls[0];
        } else {
          const chunkText = chunk.text;
          if (chunkText) {
            text += chunkText;
            // Update the last item in history for real-time feedback
            this.history[tempHistoryItemIndex] = {
              role: 'model',
              parts: [{ text }],
            };
            callbacks.onUpdate();
          }
        }
      }

      // Remove the temporary streaming item
      this.history.pop();

      if (functionCall) {
        this.history.push({
          role: 'model',
          parts: [{ functionCall: functionCall }],
        });
        callbacks.onUpdate();

        const toolResult = await callbacks.executeTool(
          functionCall.name,
          JSON.stringify(functionCall.args),
        );

        this.history.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: functionCall.name,
                response: { content: toolResult },
              },
            },
          ],
        });
        callbacks.onUpdate();
      } else {
        this.history.push({
          role: 'model',
          parts: [{ text }],
        });
        callbacks.onUpdate();
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