
import { Bash, MountableFs, ReadWriteFs } from 'just-bash';

const BashTool = {
  description: 'Execute bash commands.',
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
  async run(command: string): Promise<string> {
    const mountableFs = new MountableFs();

    const hostFs = new ReadWriteFs({ root: process.env.INIT_CWD });
    mountableFs.mount('/home/user/project', hostFs);

    const bash = new Bash({ cwd: '/home/user/project', fs: mountableFs });

    const result = await bash.exec(command);
    if (result.stdout) {
      return result.stdout;
    }

    if (result.stderr) {
        return result.stderr;
    }

    return '';
  },
};

export default BashTool;
