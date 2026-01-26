import { Tool } from './tool.js';

export interface ToolProvider {
  fetch: () => Promise<Tool[]>;
}
