import { Tool, ToolProvider } from 'matt-code-api';

import BashTool from './tools/bash.js';

class YoloBashToolProvider implements ToolProvider {
  public async fetch(): Promise<Tool[]> {
    return [BashTool];
  }
}

export default new YoloBashToolProvider();
