//#region imports
import * as _ from 'lodash';
import * as path from 'path';
import { Helpers, Project } from 'tnp-helpers';
import { URL } from 'url';
import { config } from 'tnp-config';
import * as moment from 'moment';
import { talkback, Options, RecordMode } from 'ng-talkback';
import * as glob from 'glob';
import { Scenario, ScenarioParam, ScenarioParams, ScenarioParamsReturn } from './scenario.backend';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import { Models } from 'tnp-models';
//#endregion

//#region models
export type RecorderConfigMeta = {
  [recordHostName: string]: { host: number | string | URL; talkbackProxyPort?: number | string; }
} & { scenarioName: string; }

export type ReplayConfigMeta = {
  [recordHostName: string]: { talkbackProxyPort?: number | string; }
} & { scenarioPath: string; }

interface RecordArgType {
  record: {
    /**
     * url with host to record
     */
    url: URL;
    /**
     * Identifier of what was the name or id of server.
     * this metadata is usefull to replay back multiple servers
     * on different talkback ports
     */
    name: string;
  };
  /**
   * talkback port for localhost proxy
   */
  talkbackProxyPort: number;
}

interface ScenarioArgType {
  scenario: Scenario;
  /**
   * How to map multiple servers to multiple replay instances
   */
  params?: ScenarioParamsReturn | URL[];
}
//#endregion

export class RecordReplayReqResScenario {

  //#region consts
  /**
   * by pinging to http://localhost:5544/path/to/something
   * you are actually recording request from
   * by pinging to http://< host for recording >/path/to/something
   */
  readonly DEFAULT_TALKBACK_PROXY_SERVER_PORT = 5544;
  //#endregion

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
    if (!RecordReplayReqResScenario._instances[cwd]) {
      RecordReplayReqResScenario._instances[cwd] = new RecordReplayReqResScenario(cwd);
    }
    return RecordReplayReqResScenario._instances[cwd] as RecordReplayReqResScenario;
  }
  //#endregion

  //#region resolve recoard args
  private resolveArgsRecord(serverHostOrPort: string | string[] | RecorderConfigMeta)
    : { args: RecordArgType[]; scenarioName: string; } {

    const results = [] as RecordArgType[];
    const configMeta = ((_.isObject(serverHostOrPort) && !_.isArray(serverHostOrPort))
      ? serverHostOrPort : void 0) as RecorderConfigMeta;
    let scenarioName = '' as string;
    let talkbackPorts = [this.DEFAULT_TALKBACK_PROXY_SERVER_PORT];

    if (configMeta) {
      //#region by config
      scenarioName = configMeta.scenarioName;
      _.keys(configMeta).forEach((name, i) => {
        const url = Helpers.urlParse(configMeta[name].host);
        results.push({
          record: {
            name,
            url
          },
          talkbackProxyPort: Number(configMeta[name].talkbackProxyPort) + i
        })
      })
      //#endregion
    } else {
      //#region by command line argument
      const { commandString, resolved } = Helpers.cliTool.argsFromBegin<URL>(
        serverHostOrPort as string,
        a => Helpers.urlParse(a)
      );
      scenarioName = commandString;
      let options = Helpers.cliTool.argsFrom<{ port: string; hostName: string; }>(scenarioName);
      scenarioName = Helpers.cliTool.cleanCommand(scenarioName, options);
      if (_.isArray(options.port)) {
        talkbackPorts = options.port;
      } else if (!isNaN(Number(options.port))) {
        talkbackPorts = [Number(options.port)];
      }
      const hostName = _.isString(options.hostName) ? [options.hostName]
        : (_.isArray(options.hostName) ? options.hostName : [])

      if (talkbackPorts.length === 0) {
        Helpers.error(`[rec-scenario-rep-rec] Incorrect configuration of ports:
          recordHosts = ${resolved.map(c => Helpers.urlParse(c)).join(', ')}
          talkback ports = ${talkbackPorts.join(', ')}

          `, false, true);
      }
      if (talkbackPorts.length < resolved.length) {
        const lastN = talkbackPorts[talkbackPorts.length - 1];
        _.times((resolved.length - talkbackPorts.length), (i) => talkbackPorts.push(lastN + (i + 1)));
      }

      resolved.forEach((recordHost, i) => {
        results.push({
          record: {
            name: hostName[i] ? hostName[i] : '',
            url: recordHost
          },
          talkbackProxyPort: talkbackPorts[i]
        })
      });
      //#endregion
    }

    return { args: results, scenarioName };
  }
  //#endregion

  //#region record
  /**
   *  rest-scenario-rep-rec record http://localhost:4444 Recording localhost data
   *  rest-scenario-rep-rec record http://192.168.10.22:4444 Test scenario
   *  rest-scenario-rep-rec record 4444 local setup test
   *  rest-scenario-rep-rec record 4444 5555 http://192.168.12.3 "my super scenario"
   *  rest-scenario-rep-rec record 4444 5555 http://192.168.12.3 192.158.32.3 'my super scenario --port 6767'
  *                                <port or host for record   >  <scenario name    > < talkbback server ports for proxy >
   *  rest-scenario-rep-rec record 4444 5555  http://my.api.com   'my super scenario --port 6767 --port 7777 --port 8888'
   *  ins.record( { portOrHost: http://192.129.23.12; name: 'localApiProxy'  }, 'super scenario')
   */
  async record(serverHostOrPort: string | string[] | RecorderConfigMeta) {
    const currentDate = new Date();
    let { args, scenarioName } = this.resolveArgsRecord(serverHostOrPort);

    //#region prepare main scenario folder
    let description = scenarioName;
    if (!_.isString(scenarioName) || scenarioName.trim() === '') {
      scenarioName = `new-scenario-${_.kebabCase(moment(currentDate).format('MMMM Do YYYY, h:mm:ss a'))}`;;
      description = _.startCase(scenarioName);
    }
    const scenarioNameKebabKase = _.kebabCase(scenarioName);
    const scenariosFolder = path.join(this.cwd, config.folder.tmpScenarios);
    const scenarioKebabPath = path.join(scenariosFolder, scenarioNameKebabKase);
    const packageJsonFroScenario = path.join(scenarioKebabPath, config.file.package_json);

    if (!Helpers.exists(scenariosFolder)) {
      Helpers.mkdirp(scenariosFolder);
    }
    Helpers.removeFolderIfExists(scenarioKebabPath);
    //#endregion

    //#region write package.json
    Helpers.writeFile(packageJsonFroScenario, {
      name: scenarioNameKebabKase,
      description,
      version: '0.0.0',
      creationDate: currentDate.toDateString(),
      scripts: {
        start: 'firedev serve',
      },
      tnp: {
        type: 'scenario',
      } as any,
    } as Partial<Models.npm.IPackageJSON>);
    //#endregion

    args.forEach(recData => {
      Helpers.log(`RECORD FROM: ${recData.record.url.href}`)

      const scenarioPath = path.join(
        this.cwd,
        config.folder.tmpScenarios,
        scenarioNameKebabKase,
        `${(_.kebabCase(recData.record.url.href)).toString()}__${_.camelCase(recData.record.name)}`
      );

      Helpers.remove(scenarioPath);

      const talkbackHost = recData.record.url.origin;
      Helpers.log(`Talkback host: ${talkbackHost}`)
      const server = talkback({
        host: talkbackHost,
        record: RecordMode.OVERWRITE,
        port: recData.talkbackProxyPort,
        path: scenarioPath,
        silent: true,
      } as Options);
      server.start(() => {
        Helpers.info(`"Talkback Started" on port ${recData.talkbackProxyPort} `
          + `(http://localhost:${recData.talkbackProxyPort})  => proxy to ${recData.record.url.href}`);
      });
    })

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

  //#region resolve replay args
  private resolveReplayData(nameOrPathOrDescription: string | string[] | ReplayConfigMeta) {
    if (_.isObject(nameOrPathOrDescription) && !_.isArray(nameOrPathOrDescription)) {
      //#region config
      const configMeta = nameOrPathOrDescription as ReplayConfigMeta;
      const scenario = Scenario.From(configMeta.scenarioPath)
      if (!scenario) {
        Helpers.error(`[rest-scenario...] Scenario not found in "${configMeta.scenarioPath}"`
          , false, true)
      }
      return [{
        scenario,
        params: _
          .keys(configMeta)
          .filter(key => _.isObject(configMeta[key]))
          .reduce((prev, curr) => {
            const v = configMeta[curr];
            const toMerge: ScenarioParamsReturn = {
              [curr]: Helpers.urlParse(v.talkbackProxyPort)
            };
            return _.merge(prev, toMerge);
          }, {} as ScenarioParamsReturn)
      } as ScenarioArgType];
      //#endregion
    } else {
      let portsOrUrlsForReplayServer = [Helpers.urlParse(this.DEFAULT_TALKBACK_PROXY_SERVER_PORT)] as URL[];
      nameOrPathOrDescription = (_.isArray(nameOrPathOrDescription)
        ? nameOrPathOrDescription.join(' ') : nameOrPathOrDescription) as string;

      const options = Helpers.cliTool.argsFrom<{ port: string | string[]; hostName: string | string[]; }>(nameOrPathOrDescription);
      nameOrPathOrDescription = Helpers.cliTool.cleanCommand<{ port: string | string[]; hostName: string | string[]; }>(
        nameOrPathOrDescription, options);

      const { resolved, commandString } = Helpers.cliTool
        .argsFromBegin<Scenario>(nameOrPathOrDescription, possiblePathToScenario => {
          const scenarioFromPath = (
            path.isAbsolute(possiblePathToScenario || '') &&
            Helpers.exists(possiblePathToScenario))
            ? possiblePathToScenario
            : path.join(
              this.cwd,
              config.folder.tmpScenarios,
              (possiblePathToScenario || '').trim());
          return Scenario.From(scenarioFromPath);
        });
      nameOrPathOrDescription = commandString;
      let scenarios = resolved;

      if (scenarios.length === 0 && commandString.trim() !== '') {
        const list = this.allScenarios;
        const { matches, results } = Helpers
          .arrays
          .fuzzy<Scenario>(nameOrPathOrDescription, list, (m) => m.description);
        scenarios = scenarios.concat(results);
      }

      let params = portsOrUrlsForReplayServer.map(p => Helpers.urlParse(p));
      // const hostName = _.isString(options.hostName) ? [options.hostName]
      //   : (_.isArray(options.hostName) ? options.hostName : []);
      // if (hostName.length > 0) {
      //   const newParams = {};
      //   if (hostName.length > 1 && (hostName.length !== portsOrUrlsForReplayServer.length)) {
      //     Helpers.error(`Please provide correct number or ports and hostnames
      //     host names = ${hostName.map(c => Helpers.urlParse(c)).join(', ')}
      //     talkback ports = ${portsOrUrlsForReplayServer.join(', ')}
      //     `, false, true);
      //   }
      //   hostName.forEach(name => {
      //     newParams[name] = portsOrUrlsForReplayServer[name];
      //   });
      //   params = newParams
      // }
      // @LAST

      return scenarios.map((scenario) => {
        return {
          scenario,
          params
        }
      }) as ScenarioArgType[];
    }
  }
  //#endregion

  //#region replay
  async resolveScenariosData(
    nameOrPathOrDescription: string | string[] | ReplayConfigMeta,
    showListIfNotMatch = false
  ) {

    const scenariosArgs = this.resolveReplayData(nameOrPathOrDescription);

    if (scenariosArgs.length === 0) {
      if (showListIfNotMatch) {
        const selectedScenario = await this.selectScenario();
        selectedScenario && scenariosArgs.push({
          params: [Helpers.urlParse(this.DEFAULT_TALKBACK_PROXY_SERVER_PORT)],
          scenario: selectedScenario
        });
      }
    }
    if (scenariosArgs.length === 0) {
      Helpers.error(`[record - replay - req - res - scenario]`
        + `Not able to find scenario by name or path "${nameOrPathOrDescription}"`, false, true);
    }

    const tmpScenarioInfo = (s: ScenarioArgType) => {
      const paramsTmpls = _.isArray(s.params) ? s.params.map(p => ` replay on ${p}`).join(',') : _.keys(s.params).reduce((a, b) => {
        return `${a}\n\t${chalk.bold(b)}:${s.params[b].href}`
      }, '')
      return `> ${chalk.bold(s.scenario.basename)} "${s.scenario.description}"` +
        paramsTmpls;
    };

    Helpers.info(`
    (${chalk.bold(scenariosArgs.length.toString())}) scenario(s) to replay: ` +
      `${scenariosArgs.map(s => tmpScenarioInfo(s)).join('\n')}`
    );
    return scenariosArgs;
  }
  //#endregion

}

