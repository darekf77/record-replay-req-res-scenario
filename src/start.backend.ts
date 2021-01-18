import { URL } from 'url';
import { RestScenarioRepRec } from './rest-scenario-rep-rec.backend';
import { Helpers } from 'tnp-helpers';

export async function run(args: string[]) {
  const ins = RestScenarioRepRec.Instance();
  const command: 'record' | 'replay' = args.shift() as any;
  if (command === 'record') {
    Helpers.clearConsole();
    await ins.record(args.shift(), args.join(' '))
  }
  if (command === 'replay') {
    const { scenario, ports, port } = await ins.resolveScenarioData(args.join(' '), true);
    await scenario.start(ports);
    process.stdin.resume();
  }
}
