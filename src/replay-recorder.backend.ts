import * as _ from 'lodash';
import * as path from 'path';
import { Helpers } from 'tnp-helpers';
import { URL } from 'url';
import { config } from 'tnp-config';
import * as moment from 'moment';
import talkback from 'talkback/es6';

//import talkback from 'talkback/es6';



export class ReplayRecorder {

  //#region singleton
  private static _instance = new ReplayRecorder();

  constructor(
    protected readonly cwd = process.cwd()
  ) {

  }
  public static get Instance() {
    return this._instance;
  }
  //#endregion

  recordPath: URL;
  async record(serverHostOrPort: string, scenarioName?: string, port = 5544) {

    let url = serverHostOrPort;
    if (!isNaN(Number(serverHostOrPort))) {
      url = `http://localhost:${Number(serverHostOrPort)}`;
    }
    this.recordPath = new URL(url);

    let orgNameScenario = scenarioName;
    if (!_.isString(scenarioName) || scenarioName.trim() === '') {
      scenarioName = `new-scenario-${_.kebabCase(moment(new Date()).format('MMMM Do YYYY, h:mm:ss a'))}`;
      orgNameScenario = _.startCase(scenarioName);
    }
    const scenarioNameKebabKase = _.kebabCase(scenarioName);

    Helpers.log(`RECORD FROM: ${this.recordPath.href.replace(/\/$/, '')}`)
    const scenarioPath = path.join(this.cwd, config.folder.tmpScenarios, scenarioNameKebabKase);
    const opts = {
      host: this.recordPath.href.replace(/\/$/, ''),
      record: talkback.Options.RecordMode.NEW,
      port,
      path: scenarioPath
    };
    Helpers.remove(scenarioPath);
    Helpers.remove(_.kebabCase(scenarioPath));
    const packageJsonFroScenario = path.join(this.cwd, config.folder.tmpScenarios, scenarioNameKebabKase, config.file.package_json);
    Helpers.writeFile(packageJsonFroScenario, {
      name: scenarioNameKebabKase,
      description: orgNameScenario,
      version: '0.0.0',
      scripts: {
        start: 'firedev serve',
      },
      tnp: {
        type: 'scenario'
      }
    })

    const server = talkback(opts);
    server.start(() => {
      Helpers.info(`"Talkback Started" on http://localhost:${port}`);
    });

    process.stdin.resume()
  }


  replay(nameOrPath: string, port = 4000) {

  }


}
