import { Command, Flags } from '@oclif/core';
import { render } from 'ink';
import { App } from '../app/App.js';

export default class UI extends Command {
  static override description = 'Open terminal UI';

  static override flags = {
    api: Flags.string({
      description: 'The API to use',
      options: ['openai', 'anthropic'],
      default: 'openai',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(UI);
    const { waitUntilExit } = render(<App api={flags.api as 'openai' | 'anthropic'} />);
    return waitUntilExit();
  }
}
