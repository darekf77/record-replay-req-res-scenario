import { ReplayRecorder } from './replay-recorder.backend';
import { Helpers } from 'tnp-helpers';



export async function run(args: string[]) {
  const ins = ReplayRecorder.Instance;
  const command: 'record' | 'replay' = args.shift() as any;
  if (command === 'record') {
    Helpers.clearConsole();
    await ins.record(args.shift(), args.join(' '))
  }
  if (command === 'replay') {
    await ins.replay(args.join(' '))
  }
}
