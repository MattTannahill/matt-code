import { ToolParameters } from './tool-parameters.js';

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  run: (command: string) => Promise<string>;
}
