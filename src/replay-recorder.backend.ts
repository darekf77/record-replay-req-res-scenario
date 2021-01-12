import * as _ from 'lodash';
import * as path from 'path';
import { Helpers, Project } from 'tnp-helpers';
import { URL } from 'url';
import { config } from 'tnp-config';
import * as moment from 'moment';
import { talkback, Options, RecordMode } from 'ng-talkback';
import * as glob from 'glob';
import { Scenario } from './scenario.backend';
import chalk from 'chalk';
import * as inquirer from 'inquirer'


//import talkback from 'ng-talkback/es6';



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
    const scenariosFolder = path.join(this.cwd, config.folder.tmpScenarios);
    if (!Helpers.exists(scenariosFolder)) {
      Helpers.mkdirp(scenariosFolder);
    }
    const scenarioPath = path.join(this.cwd, config.folder.tmpScenarios, scenarioNameKebabKase);

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

    const server = talkback({
      host: this.recordPath.href.replace(/\/$/, ''),
      record: RecordMode.OVERWRITE,
      port,
      path: scenarioPath,
      silent: true,
    } as Options);
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

  async replay(nameOrPath: string, showListIfNotMatch = false) {
    let port = 3000;
    let options = require('minimist')((nameOrPath || '').split(' '));
    if (nameOrPath.trim() !== '') {
      if (!isNaN(Number(options.port))) {
        port = Math.abs(Number(options.port));
        nameOrPath = nameOrPath
          .replace(`--port=${port}`, '')
          .replace(new RegExp(Helpers.escapeStringForRegEx(`--port\ +${port}`)), '')
      }
      // Helpers.log(`nameOrPath "${nameOrPath}"`)
      const list = this.allScenarios;
      const { matches, results } = Helpers.arrays.fuzzy<Scenario>(nameOrPath, list, (m) => m.description);
      // Helpers.log(`
      // matches ${matches.length}: ${matches.join(', ')}
      // results ${results.length}: ${results.map(s => s.basename).join(', ')}  `)
      var scenarioToProcess = _.first(results);

      if (!scenarioToProcess) {
        const scenarioFromPath = (path.isAbsolute(nameOrPath || '') && Helpers.exists(nameOrPath))
          ? nameOrPath : path.join(this.cwd, config.folder.tmpScenarios, (nameOrPath || '').trim());
        if (Helpers.exists(scenarioFromPath)) {
          scenarioToProcess = Scenario.From(scenarioFromPath);
        }
      }
    }


    if (!scenarioToProcess) {
      if (showListIfNotMatch) {
        const mainMessage = `Select scenario from list:`;
        const choices = Scenario.allCurrent.map(c => {

          return { name: c.basename, value: c }
        });


        const res = await inquirer.prompt({
          type: 'list',
          name: 'value',
          message: mainMessage,
          choices
        } as any) as any;
        scenarioToProcess = res.value;
      }
    }
    if (!scenarioToProcess) {
      Helpers.error(`[record - replay - req - res - scenario]`
        + `Not able to find scenario by name or path "${nameOrPath}"`, false, true);
    }
    Helpers.info(`

    Scenario to replay: ${ chalk.bold(scenarioToProcess.basename)}
    "${scenarioToProcess.description}"
    port: ${ port}

      `);

    await scenarioToProcess.start(new URL(`http://localhost:${port}`));
    process.stdin.resume();
  }


}
