import * as _ from 'lodash';
import * as path from 'path';
import { Helpers, Project } from 'tnp-helpers';
import { URL } from 'url';
import { config } from 'tnp-config';
import * as moment from 'moment';
import talkback from 'talkback/es6';
import * as fuzzy from 'fuzzy';
import * as glob from 'glob';
import { Scenario } from './scenario.backend';
import chalk from 'chalk';

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
  async record(serverHostOrPort: string, scenarioName?: string) {
    const currentDate = new Date();
    let port = 5544;
    let options = require('minimist')((scenarioName || '').split(' '));
    if (!isNaN(Number(options.port))) {
      port = Number(options.port);
    }

    let url = serverHostOrPort;
    if (!isNaN(Number(serverHostOrPort))) {
      url = `http://localhost:${Number(serverHostOrPort)}`;
    }
    this.recordPath = new URL(url);

    let orgNameScenario = scenarioName;
    if (!_.isString(scenarioName) || scenarioName.trim() === '') {
      scenarioName = `new-scenario-${_.kebabCase(moment(currentDate).format('MMMM Do YYYY, h:mm:ss a'))}`;
      orgNameScenario = _.startCase(scenarioName);
    }
    const scenarioNameKebabKase = _.kebabCase(scenarioName);

    Helpers.log(`RECORD FROM: ${this.recordPath.href.replace(/\/$/, '')}`)
    const scenarioPath = path.join(this.cwd, config.folder.tmpScenarios, scenarioNameKebabKase);
    const opts = {
      host: this.recordPath.href.replace(/\/$/, ''),
      record: talkback.Options.RecordMode.OVERWRITE,
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
      creationDate: currentDate.toDateString(),
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

  get allScenarios() {
    return glob.sync(`${path.join(this.cwd, config.folder.tmpScenarios)}/*`)
      .filter(f => !!Project.From(f))
      .map(f => Scenario.From(f))
      .filter(f => !!f)
  }

  async replay(nameOrPath: string) {
    let port = 3000;
    let options = require('minimist')((nameOrPath || '').split(' '));
    if (!isNaN(Number(options.port))) {
      port = Math.abs(Number(options.port));
      nameOrPath = nameOrPath
        .replace(`--port=${port}`, '')
        .replace(new RegExp(Helpers.escapeStringForRegEx(`--port\ +${port}`)), '')
    }

    const list = this.allScenarios.map(s => s.description);
    const results = fuzzy.filter(nameOrPath, list)
    const matches = results.map((el) => el.string);
    const first = _.first(this.allScenarios);
    let scenarioToProcess = first ? this.allScenarios.find(s => s.description === first.description) : void 0;

    if (!first) {
      const scenarioFromPath = (path.isAbsolute(nameOrPath || '') && Helpers.exists(nameOrPath))
        ? nameOrPath : path.join(this.cwd, config.folder.tmpScenarios, (nameOrPath || '').trim());
      scenarioToProcess = Scenario.From(scenarioFromPath);
    }

    if (!scenarioToProcess) {
      Helpers.error(`[record-replay-req-res-scenario] Not able to find scenario by name or path: ${nameOrPath}`);
    }
    Helpers.info(`

    Scenario to replay: ${chalk.bold(scenarioToProcess.basename)}
    "${scenarioToProcess.description}"
    port: ${port}

    `)
    console.log((scenarioToProcess.requests))
    process.exit(0)
    await scenarioToProcess.start(new URL(`http://localhost:${port}`));
    process.stdin.resume()
  }


}
