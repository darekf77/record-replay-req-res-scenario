//#region imports
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
import * as inquirer from 'inquirer';
import { Models } from 'tnp-models';
//#endregion

export class RestScenarioRepRec {

  //#region singleton
  private static _instances = {};

  private constructor(
    protected readonly cwd = process.cwd()
  ) {
    const pathToScenarios = path.join(cwd, config.folder.scenarios);
    const pathToScenariosTemp = path.join(cwd, config.folder.tmpScenarios);
    if (!Helpers.exists(pathToScenarios)) {
      Helpers.createSymLink(pathToScenariosTemp, pathToScenarios,
        { continueWhenExistedFolderDoesntExists: true })
    }
  }
  public static Instance(cwd = process.cwd()) {
    if (!RestScenarioRepRec._instances[cwd]) {
      RestScenarioRepRec._instances[cwd] = new RestScenarioRepRec(cwd);
    }
    return RestScenarioRepRec._instances[cwd] as RestScenarioRepRec;
  }
  //#endregion

  //#region record
  async record(serverHostOrPort: string | string[], scenarioName?: string, serverSubName = 'default') {
    const currentDate = new Date();
    let ports = [5544];
    let options = require('minimist')((scenarioName || '').split(' '));
    if (_.isArray(options.port)) {
      ports = options.port;
    } else if (!isNaN(Number(options.port))) {
      ports = [Number(options.port)];
    }

    ports = ports.map(p => Number(p)) as number[];
    ports = _.sortBy(ports);

    if (!_.isArray(serverHostOrPort) && _.isString(serverHostOrPort)) {
      serverHostOrPort = [serverHostOrPort];
    }

    const hosts = serverHostOrPort.map(url => {
      if (!isNaN(Number(url))) {
        url = `http://localhost:${Number(serverHostOrPort)}`;
      }
      const recordPath = new URL(url);
      return recordPath;
    })
    const isGroup = (hosts.length > 1);
    const groupName = `new-scenario-${_.kebabCase(moment(currentDate).format('MMMM Do YYYY, h:mm:ss a'))}`;
    let orgNameScenario = scenarioName;
    if (!_.isString(scenarioName) || scenarioName.trim() === '') {
      scenarioName = groupName;
      orgNameScenario = _.startCase(scenarioName);
    }
    const scenarioNameKebabKase = _.kebabCase(scenarioName);

    if (isGroup) {
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
          type: 'scenario',
          isGroup,
          groupSize: hosts.length,
          groupName: isGroup ? groupName : void 0
        } as any
      } as Partial<Models.npm.IPackageJSON>)
    }

    for (let index = 0; index < hosts.length; index++) {
      const recordPath = hosts[index];


      Helpers.log(`RECORD FROM: ${recordPath.href.replace(/\/$/, '')}`)
      const scenariosFolder = path.join(this.cwd, config.folder.tmpScenarios);
      if (!Helpers.exists(scenariosFolder)) {
        Helpers.mkdirp(scenariosFolder);
      }

      const scenarioPath = path.join(
        this.cwd,
        config.folder.tmpScenarios,
        scenarioNameKebabKase,
        (isGroup ? ports[index].toString() : '')
      );

      Helpers.remove(scenarioPath);
      Helpers.remove(_.kebabCase(scenarioPath));
      if (!isGroup) {
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
            type: 'scenario',
          } as any
        } as Partial<Models.npm.IPackageJSON>)
      }

      const server = talkback({
        host: recordPath.href.replace(/\/$/, ''),
        record: RecordMode.OVERWRITE,
        port: ports[index],
        path: scenarioPath,
        silent: true,
      } as Options);
      server.start(() => {
        Helpers.info(`"Talkback Started" on http://localhost:${ports[index]}`);
      });
    }
    process.stdin.resume()
  }
  //#endregion

  //#region all scenaroios
  public get allScenarios() {
    return glob.sync(`${path.join(this.cwd, config.folder.tmpScenarios)}/*`)
      .filter(f => !!Project.From(f))
      .map(f => Scenario.From(f))
      .filter(f => !!f)
  }
  //#endregion

  //#region select scenario
  async selectScenario(
    mainMessage = `Select scenario from list:`
  ): Promise<Scenario> {
    const choices = Scenario.allCurrent.map(c => {
      return { name: `"${c.description}"`, value: c }
    });


    const res = await inquirer.prompt({
      type: 'list',
      name: 'value',
      message: mainMessage,
      choices
    } as any) as any;
    return res.value;
  }
  //#endregion

  //#region replay
  async resolveScenarioData(nameOrPathOrDescription: string, showListIfNotMatch = false) {
    let ports = [3000];
    let options = require('minimist')((nameOrPathOrDescription || '').split(' '));
    let isGroup = false;
    if (nameOrPathOrDescription.trim() !== '') {
      if (_.isArray(options.port)) {
        ports = options.port;
      } else if (!isNaN(Number(options.port))) {
        ports = [Math.abs(Number(options.port))];
      }
      ports = _.sortBy(ports.map(p => Number(p))) as number[];
      isGroup = (ports.length > 1);
      ports.forEach(port => {
        nameOrPathOrDescription = nameOrPathOrDescription
          .replace(`--port=${port}`, '')
          .replace(new RegExp(Helpers.escapeStringForRegEx(`--port\ +${port}`)), '')
      });
      // Helpers.log(`nameOrPath "${nameOrPath}"`)
      const list = this.allScenarios;
      const { matches, results } = Helpers.arrays.fuzzy<Scenario>(nameOrPathOrDescription, list, (m) => m.description);
      // Helpers.log(`
      // matches ${matches.length}: ${matches.join(', ')}
      // results ${results.length}: ${results.map(s => s.basename).join(', ')}  `)
      var scenarioToProcess = _.first(results);

      if (!scenarioToProcess) {
        const scenarioFromPath = (path.isAbsolute(nameOrPathOrDescription || '') && Helpers.exists(nameOrPathOrDescription))
          ? nameOrPathOrDescription : path.join(this.cwd, config.folder.tmpScenarios, (nameOrPathOrDescription || '').trim());
        if (Helpers.exists(scenarioFromPath)) {
          scenarioToProcess = Scenario.From(scenarioFromPath);
        }
      }
    }


    if (!scenarioToProcess) {
      if (showListIfNotMatch) {
        scenarioToProcess = await this.selectScenario();
      }
    }
    if (!scenarioToProcess) {
      Helpers.error(`[record - replay - req - res - scenario]`
        + `Not able to find scenario by name or path "${nameOrPathOrDescription}"`, false, true);
    }

    Helpers.info(`

    Scenario to replay: ${chalk.bold(scenarioToProcess.basename)}
    "${scenarioToProcess.description}"
    port(s): ${isGroup ? ports.join(',') : _.first(ports)}

      `);
    return { scenario: scenarioToProcess, port: _.first(ports), ports };
  }
  //#endregion

}
