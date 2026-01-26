
import { Bash, MountableFs, ReadWriteFs } from 'just-bash';

const BashTool = {
  toolName: 'bash',
  description: 'Execute bash commands.',
  run: async (command: string): Promise<string> => {
    console.log(`[bash.ts] host process.cwd(): ${process.cwd()}`);
    console.log(`[bash.ts] command: ${command}`);

    const mountableFs = new MountableFs();

    const hostFs = new ReadWriteFs({ root: process.cwd() });
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
