import { URL } from 'url';
import { RecordReplayReqResScenario } from './record-replay-req-res-scenario.backend';
import { Helpers } from 'tnp-helpers';

export async function run(args: string[]) {
  const ins = RecordReplayReqResScenario.Instance();
  const command: 'record' | 'replay' = args.shift() as any;
  if (command === 'record') {
    Helpers.clearConsole();
    await ins.record(args)
  }
  if (command === 'replay') {
    const scenarioArgs = await ins.resolveScenariosData(args, true);
    for (let index = 0; index < scenarioArgs.length; index++) {
      const s = scenarioArgs[index];
      await s.scenario.start(s.params);
    }
    process.stdin.resume();
  }
}
