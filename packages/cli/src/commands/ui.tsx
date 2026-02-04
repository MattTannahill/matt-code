import { Command } from '@oclif/core';
import { render } from 'ink';

import { App } from '../app/app.js';
import { SessionFactory } from '../app/session.js';

export default class UI extends Command {
  static override description = 'Open terminal UI';

  public async run(): Promise<void> {
    const sessionFactory = new SessionFactory(this.config);
    const { waitUntilExit } = render(<App sessionFactory={sessionFactory} />);
    return waitUntilExit();
  }
}
