import { Tool, ToolProvider } from 'matt-code-api';
import BashTool from './tools/bash.js';

class JustBashToolProvider implements ToolProvider {
  public async fetch(): Promise<Tool[]> {
    return [BashTool];
  }
}

export default new JustBashToolProvider();
