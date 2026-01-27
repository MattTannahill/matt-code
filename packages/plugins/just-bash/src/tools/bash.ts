
import { Bash, MountableFs, ReadWriteFs } from 'just-bash';

const BashTool = {
  name: 'bash',
  description: 'Execute bash commands.',
  parameters: {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute.',
      },
    },
    required: ['command'],
  },
  run: async (command: string): Promise<string> => {
    const mountableFs = new MountableFs();

    const hostFs = new ReadWriteFs({ root: process.env.INIT_CWD });
    mountableFs.mount('/home/user/project', hostFs);

    const bash = new Bash({ fs: mountableFs, cwd: '/home/user/project' });

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
