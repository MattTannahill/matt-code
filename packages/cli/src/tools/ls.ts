import { exec } from 'child_process';
import { promisify } from 'util';

const execp = promisify(exec);

export default class LS {
  static toolName = 'ls';
  static description = 'Lists the contents of the current directory';

  /**
   * Run the ls tool.
   * @param args optional args string passed to ls (e.g., "-la" or a path)
   * @returns stdout or stderr as a string
   */
  static async run(args = ''): Promise<string> {
    const trimmed = args.trim();
    const lsArgs = trimmed || '-la';
    try {
      const { stdout, stderr } = await execp(`ls ${lsArgs}`, {
        cwd: process.cwd(),
      });
      return (stdout || stderr || '').toString();
    } catch (err: unknown) {
      if (err instanceof Error) {
        return err.message;
      }
      return String(err);
    }
  }
}
