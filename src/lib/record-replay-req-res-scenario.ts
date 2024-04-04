// //#region imports
// //#region @backend
// import * as _ from 'lodash';
// import * as path from 'path';
// import { Helpers, BaseProject as Project } from 'tnp-helpers';
// import { URL } from 'url';
// import { config } from 'tnp-config';
// import * as moment from 'moment';
// import { talkback, Options, RecordMode } from 'ng-talkback';
// import * as glob from 'glob';
// import { Scenario, ScenarioParam, ScenarioParams, ScenarioParamsReturn } from './scenario.backend';
// import chalk from 'chalk';
// import * as inquirer from 'inquirer';
// // import { Models } from 'tnp-models';
// //#endregion
// //#endregion

// //#region models
// export type RecordData = { host: number | string | URL; talkbackProxyPort?: number | string; }

// export type RecorderConfigMeta = {
//   [recordHostName: string]: RecordData;
// } & { scenarioName: string; }

// export type ReplayConfigMeta = {
//   [recordHostName: string]: { talkbackProxyPort?: number | string; }
// } & { scenarioPath: string; }

// type ArgsOptReplayRecordArgType = { port: string | string[]; hostName: string | string[]; };

// interface RecordArgType {
//   record: {
//     /**
//      * url with host to record
//      */
//     url: URL;
//     /**
//      * Identifier of what was the name or id of server.
//      * this metadata is usefull to replay back multiple servers
//      * on different talkback ports
//      */
//     name: string;
//   };
//   /**
//    * talkback port for localhost proxy
//    */
//   talkbackProxyPort: number;
// }

// //#endregion

// export class RecordReplayReqResScenario {
//   //#region @backend

//   //#region consts
//   /**
//    * by pinging to http://localhost:5544/path/to/something
//    * you are actually recording request from
//    * by pinging to http://< host for recording >/path/to/something
//    */
//   readonly DEFAULT_TALKBACK_PROXY_SERVER_PORT = 5544;
//   //#endregion

//   //#region singleton
//   private static _instances = {};

//   private constructor(
//     protected readonly cwd = process.cwd()
//   ) {
//     const pathToScenarios = path.join(cwd, config.folder.scenarios);
//     const pathToScenariosTemp = path.join(cwd, config.folder.tmpScenarios);
//     if (!Helpers.exists(pathToScenarios)) {
//       Helpers.createSymLink(pathToScenariosTemp, pathToScenarios,
//         { continueWhenExistedFolderDoesntExists: true })
//     }
//   }
//   public static Instance(cwd = process.cwd()) {
//     if (!RecordReplayReqResScenario._instances[cwd]) {
//       RecordReplayReqResScenario._instances[cwd] = new RecordReplayReqResScenario(cwd);
//     }
//     return RecordReplayReqResScenario._instances[cwd] as RecordReplayReqResScenario;
//   }
//   //#endregion

//   //#region resolve recoard args
//   private resolveArgsRecord(serverHostOrPort: string | string[] | RecorderConfigMeta)
//     : { args: RecordArgType[]; scenarioName: string; } {

//     const results = [] as RecordArgType[];
//     const configMeta = ((_.isObject(serverHostOrPort) && !_.isArray(serverHostOrPort))
//       ? serverHostOrPort : void 0) as RecorderConfigMeta;
//     let scenarioName = '' as string;
//     let talkbackPorts = [this.DEFAULT_TALKBACK_PROXY_SERVER_PORT];

//     if (configMeta) {
//       //#region by config
//       scenarioName = configMeta.scenarioName;
//       _.keys(configMeta)
//         .filter(key => _.isObject(configMeta[key]))
//         .forEach((name, i) => {
//           const url = Helpers.urlParse(configMeta[name].host);
//           results.push({
//             record: {
//               name,
//               url
//             },
//             talkbackProxyPort: Number(configMeta[name].talkbackProxyPort) + i
//           })
//         })
//       //#endregion
//     } else {
//       //#region by command line argument
//       const { commandString, resolved } = Helpers.cliTool.argsFromBegin<URL>(
//         serverHostOrPort as string,
//         a => Helpers.urlParse(a)
//       );
//       scenarioName = commandString;
//       let options = Helpers.cliTool.argsFrom<{ port: string; hostName: string; }>(scenarioName);
//       scenarioName = Helpers.cliTool.cleanCommand(scenarioName, options);
//       if (_.isArray(options.port)) {
//         talkbackPorts = options.port;
//       } else if (!isNaN(Number(options.port))) {
//         talkbackPorts = [Number(options.port)];
//       }
//       const hostName = _.isString(options.hostName) ? [options.hostName]
//         : (_.isArray(options.hostName) ? options.hostName : [])

//       if (talkbackPorts.length === 0) {
//         Helpers.error(`[rec-scenario-rep-rec] Incorrect configuration of ports:
//           recordHosts = ${resolved.map(c => Helpers.urlParse(c)).join(', ')}
//           talkback ports = ${talkbackPorts.join(', ')}

//           `, false, true);
//       }
//       if (talkbackPorts.length < resolved.length) {
//         const lastN = talkbackPorts[talkbackPorts.length - 1];
//         _.times((resolved.length - talkbackPorts.length), (i) => talkbackPorts.push(lastN + (i + 1)));
//       }

//       resolved.forEach((recordHost, i) => {
//         results.push({
//           record: {
//             name: hostName[i] ? hostName[i] : '',
//             url: recordHost
//           },
//           talkbackProxyPort: talkbackPorts[i]
//         })
//       });
//       //#endregion
//     }

//     return { args: results, scenarioName };
//   }
//   //#endregion

//   //#region command from config
//   public recordAsWorker(config: RecorderConfigMeta, cwd: string = process.cwd()) {
//     const hosts = Object
//       .keys(config)
//       .filter(hostName => _.isObject(config[hostName]))
//       .map(hostName => {
//         const v = config[hostName] as RecordData;
//         return (v.host as URL).origin;
//       });
//     const portName = Object
//       .keys(config)
//       .filter(hostName => _.isObject(config[hostName]))
//       .map(hostName => {
//         const v = config[hostName] as RecordData;
//         return `--port ${v.talkbackProxyPort} --hostName ${hostName}`
//       })
//     let command = `record-replay-req-res-scenario record ${hosts.join(' ')} '${config.scenarioName}' ${portName.join(' ')}`;
//     Helpers.run(command, { cwd }).async();
//   }
//   //#endregion

//   //#region record
//   /**
//    *  rest-scenario-rep-rec record http://localhost:4444 Recording localhost data
//    *  rest-scenario-rep-rec record http://192.168.10.22:4444 Test scenario
//    *  rest-scenario-rep-rec record 4444 local setup test
//    *  rest-scenario-rep-rec record 4444 5555 http://192.168.12.3 "my super scenario"
//    *  rest-scenario-rep-rec record 4444 5555 http://192.168.12.3 192.158.32.3 'my super scenario --port 6767'
//   *                                <port or host for record   >  <scenario name    > < talkbback server ports for proxy >
//    *  rest-scenario-rep-rec record 4444 5555  http://my.api.com   'my super scenario --port 6767 --port 7777 --port 8888'
//    *  ins.record( { portOrHost: http://192.129.23.12; name: 'localApiProxy'  }, 'super scenario')
//    */
//   async record(serverHostOrPort: string | string[] | RecorderConfigMeta, debug = false) {
//     return new Promise((resolve, reject) => {
//       const currentDate = new Date();
//       let { args, scenarioName } = this.resolveArgsRecord(serverHostOrPort);

//       //#region prepare main scenario folder
//       let description = scenarioName;
//       if (!_.isString(scenarioName) || scenarioName.trim() === '') {
//         scenarioName = `new-scenario-${_.kebabCase(moment(currentDate).format('MMMM Do YYYY, h:mm:ss a'))}`;;
//         description = _.startCase(scenarioName);
//       }
//       const scenarioNameKebabKase = _.kebabCase(scenarioName);
//       const scenariosFolder = path.join(this.cwd, config.folder.tmpScenarios);
//       const scenarioKebabPath = path.join(scenariosFolder, scenarioNameKebabKase);
//       const packageJsonFroScenario = path.join(scenarioKebabPath, config.file.package_json);

//       if (!Helpers.exists(scenariosFolder)) {
//         Helpers.mkdirp(scenariosFolder);
//       }
//       Helpers.removeFolderIfExists(scenarioKebabPath);
//       //#endregion

//       //#region write package.json
//       Helpers.writeFile(packageJsonFroScenario, {
//         name: scenarioNameKebabKase,
//         description,
//         version: '0.0.0',
//         creationDate: currentDate.toDateString(),
//         scripts: {
//           start: 'firedev serve',
//         },
//         tnp: {
//           type: 'scenario',
//         } as any,
//       } as Partial<Models.npm.IPackageJSON>);
//       //#endregion

//       args.forEach(recData => {
//         Helpers.log(`RECORD FROM: ${recData.record.url.href}`)

//         const scenarioPath = path.join(
//           this.cwd,
//           config.folder.tmpScenarios,
//           scenarioNameKebabKase,
//           `${(_.kebabCase(recData.record.url.href)).toString()}__${_.camelCase(recData.record.name)}`
//         );

//         Helpers.remove(scenarioPath);

//         const talkbackHost = recData.record.url.origin;
//         debug && Helpers.info(`Talkback host: ${talkbackHost}`)
//         const server = talkback({
//           host: talkbackHost,
//           record: RecordMode.NEW,
//           port: recData.talkbackProxyPort,
//           path: scenarioPath,
//           silent: true,
//           // debug: true
//         } as Options);
//         server.start(() => {
//           Helpers.info(`"Talkback Started" on port ${recData.talkbackProxyPort} `
//             + `( click for test ${chalk.bold(recData.record?.name ? recData.record.name : '')} `
//             + `http://localhost:${recData.talkbackProxyPort}/ng-talkback-test  )  => proxy to ${recData.record.url.href}`);
//           resolve(void 0);
//         });
//       })
//     });
//   }
//   //#endregion

//   //#region all scenaroios
//   public get allScenarios() {
//     return glob.sync(`${path.join(this.cwd, config.folder.tmpScenarios)}/*`)
//       .filter(f => !!Project.ins.From(f))
//       .map(f => Scenario.From(f))
//       .filter(f => !!f)
//   }
//   //#endregion

//   //#region select scenario
//   async selectScenario(goBackButtonOnList?: boolean): Promise<Scenario> {
//     const mainMessage = `Select scenario from list:`;
//     const choices = Scenario.allCurrent.map(c => {
//       return { name: `"${c.description}"`, value: c }
//     });
//     if (goBackButtonOnList) {
//       choices.push({ name: '<= Go back', value: void 0 });
//     }

//     const res = await inquirer.prompt({
//       type: 'list',
//       name: 'value',
//       message: mainMessage,
//       choices
//     } as any) as any;
//     return res.value;
//   }
//   //#endregion

//   //#region resolve replay args
//   private async resolveReplayData(
//     nameOrPathOrDescription: string | string[] | ReplayConfigMeta,
//     showListIfNotMatch = false,
//     goBackButtonOnList = false,
//   ) {
//     const returnValue = { scenarios: [] as Scenario[], params: void 0 as ScenarioParamsReturn }
//     if (_.isObject(nameOrPathOrDescription) && !_.isArray(nameOrPathOrDescription)) {
//       //#region config
//       const configMeta = nameOrPathOrDescription as ReplayConfigMeta;
//       const scenario = Scenario.From(configMeta.scenarioPath)
//       if (!scenario) {
//         Helpers.error(`[rest-scenario...] Scenario not found in "${configMeta.scenarioPath}"`
//           , false, true)
//       }
//       returnValue.scenarios = [scenario];
//       returnValue.params = _.pickBy(configMeta, _.isObject) as ScenarioParamsReturn;
//       //#endregion
//     } else {
//       //#region from command line

//       nameOrPathOrDescription = (_.isArray(nameOrPathOrDescription)
//         ? nameOrPathOrDescription.join(' ') : nameOrPathOrDescription) as string;

//       const options = Helpers.cliTool.argsFrom<ArgsOptReplayRecordArgType>(nameOrPathOrDescription);
//       nameOrPathOrDescription = Helpers.cliTool.cleanCommand(nameOrPathOrDescription, options);

//       const { resolved, commandString } = Helpers.cliTool
//         .argsFromBegin<Scenario>(nameOrPathOrDescription, possiblePathToScenario => {
//           const scenarioFromPath = (
//             path.isAbsolute(possiblePathToScenario || '') &&
//             Helpers.exists(possiblePathToScenario))
//             ? possiblePathToScenario
//             : path.join(
//               this.cwd,
//               config.folder.tmpScenarios,
//               (possiblePathToScenario || '').trim());
//           return Scenario.From(scenarioFromPath);
//         });
//       nameOrPathOrDescription = commandString;
//       let scenarios = resolved;

//       if (scenarios.length === 0 && commandString.trim() !== '') {
//         const list = this.allScenarios;
//         const { matches, results } = Helpers
//           .arrays
//           .fuzzy<Scenario>(nameOrPathOrDescription, list, (m) => m.description);
//         scenarios = scenarios.concat(results);
//       }

//       const hostName = _.isString(options.hostName) ? [options.hostName]
//         : (_.isArray(options.hostName) ? options.hostName : []);

//       const portsOrUrlsForReplayServer = (_.isString(options.port) ? [Helpers.urlParse(options.port)]
//         : (_.isArray(options.port) ? options.port.map(p => Helpers.urlParse(p))
//           : [Helpers.urlParse(this.DEFAULT_TALKBACK_PROXY_SERVER_PORT)])).filter(u => u instanceof URL);

//       if (portsOrUrlsForReplayServer.length === 0) {
//         Helpers.error(`Please provide correct number or ports and hostnames
//           host names = ${hostName.map(c => Helpers.urlParse(c)).join(', ')}
//           talkback ports = ${portsOrUrlsForReplayServer.join(', ')}
//           `, false, true);
//       }

//       let params = portsOrUrlsForReplayServer;

//       if (hostName.length > 0) {
//         if (hostName.length > portsOrUrlsForReplayServer.length) {
//           const maxPort = _.maxBy(portsOrUrlsForReplayServer, p => Number(p.port));
//           _.times(hostName.length - portsOrUrlsForReplayServer.length, n => {
//             portsOrUrlsForReplayServer.push(Helpers.urlParse(Number(maxPort.port) + (n + 1)))
//           });
//         }
//         params = hostName.reduce((prev, name, i) => {
//           return _.merge(prev, { [name]: portsOrUrlsForReplayServer[i] })
//         }, {}) as any;
//       }

//       returnValue.params = params as any;
//       returnValue.scenarios = scenarios;
//       //#endregion
//     }

//     //#region select menu scenraios
//     if (returnValue.scenarios.length === 0) {
//       if (showListIfNotMatch) {
//         const selectedScenario = await this.selectScenario(goBackButtonOnList);
//         returnValue.scenarios.push(selectedScenario);
//       }
//     }
//     //#endregion

//     return returnValue;
//   }
//   //#endregion

//   //#region replay
//   public async resolveScenariosData(
//     nameOrPathOrDescription: string | string[] | ReplayConfigMeta,
//     showListIfNotMatch = false,
//     goBackButtonOnList = false,
//   ) {

//     const { scenarios, params } = await this.resolveReplayData(
//       nameOrPathOrDescription,
//       showListIfNotMatch,
//       goBackButtonOnList,
//     );

//     if (scenarios.length === 0) {
//       Helpers.error(`[record - replay - req - res - scenario]`
//         + `Not able to find scenario by name or path "${nameOrPathOrDescription}"`, false, true);
//     }

//     // const tmpScenarioInfo = (s: Scenario) => {
//     //   const paramsTmpls = _.isArray(params) ? params.map(p => ` replay on ${p}`).join(',')
//     //     : _.keys(params).reduce((a, b) => {
//     //       return `${a}\n\t${chalk.bold(b)}:${params[b].href}`
//     //     }, '')
//     //   return `> ${chalk.bold(s.basename)} "${s.description}"` +
//     //     paramsTmpls;
//     // };

//     // Helpers.info(`
//     // (${chalk.bold(scenarios.length.toString())}) scenario(s) to replay: `
//     //   + `${scenarios.map(s => tmpScenarioInfo(s)).join('\n')}`
//     // );
//     return { scenario: _.first(scenarios), scenarios, params };
//   }
//   //#endregion

//   //#endregion
// }

