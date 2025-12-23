// @ts-nocheck
//#region @notForNpm
import { Taon } from 'taon/src';

export async function start() {
  console.log('hello');
}

export default start;
//#endregion

//#region  record-replay-req-res-scenario component
//#region @browser
@Component({ template: 'hello world fromr record-replay-req-res-scenario' })
export class RecordReplayReqResScenarioComponent {}
//#endregion
//#endregion

//#region  record-replay-req-res-scenario module
//#region @browser
@NgModule({
  declarations: [RecordReplayReqResScenarioComponent],
  imports: [CommonModule],
  exports: [RecordReplayReqResScenarioComponent],
})
export class RecordReplayReqResScenarioModule {}
//#endregion
//#endregion