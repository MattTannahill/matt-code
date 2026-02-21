import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BashTool = {
  description: 'Execute bash commands on the host system.',
  name: 'bash',
  parameters: {
    properties: {
      command: {
        description: 'The bash command to execute.',
        type: 'string',
      },
    },
    required: ['command'],
    type: 'object' as const,
  },
  async run({ command }: { command: string }): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command);
      if (stdout) {
        return stdout;
      }
      if (stderr) {
        return stderr;
      }
      return '';
    } catch (error: any) {
      if (error.stdout || error.stderr) {
        return `${error.stdout || ''}${error.stderr || ''}`;
      }
      return error.message;
    }
  },
};

export default BashTool;
