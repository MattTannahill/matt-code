import { Command } from '@oclif/core';
import { render } from 'ink';

import { App } from '../app/app.js';

export default class UI extends Command {
  static override description = 'Open terminal UI';

  public async run(): Promise<void> {
    const { waitUntilExit } = render(<App config={this.config} />);
    return waitUntilExit();
  }
}
