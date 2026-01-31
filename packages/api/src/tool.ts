import { ToolParameters } from './tool-parameters.js';

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  run: (args: any) => Promise<string>;
}
