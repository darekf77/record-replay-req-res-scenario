import { Application } from 'express';
import * as _ from 'lodash';
import * as glob from 'glob';
import * as path from 'path';
import * as express from 'express';
import * as http from 'http';
import * as fse from 'fs-extra';
import * as  cors from 'cors';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as methodOverride from 'method-override';
import * as fileUpload from 'express-fileupload';
import { Models } from 'tnp-models';
import { Helpers } from 'tnp-helpers';
import { config } from 'tnp-config';
import { URL } from 'url';
import { Tape } from './tape.backend';

export type PortOrURL = URL | number;
export type ScenarioParams = { [nameOfParam: string]: PortOrURL; };
export type ScenarioParamsReturn = { [nameOfParam: string]: Exclude<PortOrURL, number>; };
export type ScenarioParam = { name: string; portOrUrl: PortOrURL; }
export type ScenarioParamReturn = { name: string; portOrUrl: Exclude<PortOrURL, number>; }

export class Scenario {

  public static get allCurrent() {
    const currentScenariosFolder = path.join(process.cwd(), config.folder.tmpScenarios);
    return !fse.existsSync(currentScenariosFolder) ? [] : fse
      .readdirSync(currentScenariosFolder)
      .map(p => Scenario.From(path.join(currentScenariosFolder, p)))
      .filter(f => !!f)
  }

  private static instances = {};
  static From(pathToScenario: string) {
    if (!Helpers.exists(pathToScenario)) {
      return void 0;
    }
    if (!Scenario.instances[pathToScenario]) {
      Scenario.instances[pathToScenario] = new Scenario(pathToScenario)
    }
    return Scenario.instances[pathToScenario] as Scenario;
  }

  get basename() {
    return path.basename(this.location);
  }
  public get description() {
    return this.packageJson?.description ? this.packageJson?.description
      : _.startCase(this.packageJson?.name);
  }
  private packageJson: Models.npm.IPackageJSON;
  constructor(
    private readonly location: string
  ) {
    const pathToScenarioPackageJson = path.join(location, config.file.package_json);
    // Helpers.log(`path to scenario pj: ${pathToScenarioPackageJson}`)
    this.packageJson = Helpers.readJson(pathToScenarioPackageJson);
  }

  private initMidleware(app: express.Application) {

    app.use(fileUpload())
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.use(methodOverride());
    app.use(cookieParser());
    app.use(cors());

    (() => {
      app.use((req, res, next) => {

        res.set('Access-Control-Expose-Headers',
          [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
          ].join(', '))
        next();
      });
    })()
  }


  private initRequests(app: express.Application, name?: string) {
    const allReq = this.tapes(name);

    app.get(/^\/(.*)/, (req, res) => {
      respond(allReq, req, res);
    });
    app.post(/^\/(.*)/, (req, res) => {
      respond(allReq, req, res);
    });
    app.delete(/^\/(.*)/, (req, res) => {
      respond(allReq, req, res);
    });
    app.put(/^\/(.*)/, (req, res) => {
      respond(allReq, req, res);
    });
    app.head(/^\/(.*)/, (req, res) => {
      respond(allReq, req, res);
    });
  }

  async start(urlsOrPorts: number | number[] | URL | URL[] | ScenarioParams) {
    if (_.isString(urlsOrPorts)) {
      urlsOrPorts = [Number(urlsOrPorts)]
    }
    if (urlsOrPorts instanceof URL) {
      urlsOrPorts = [Number(urlsOrPorts.port)]
    }
    if (_.isArray(urlsOrPorts)) {
      urlsOrPorts = (urlsOrPorts as (number | URL)[]).map(portLocalHOst => {
        if (portLocalHOst instanceof URL) {
          portLocalHOst = Number(portLocalHOst);
        }
        return Number(portLocalHOst)
      });
      urlsOrPorts = urlsOrPorts.reduce((a, b, i) => {
        return _.merge(a, { [i]: Helpers.urlParse(b) })
      }, {}) as ScenarioParams;
    }
    urlsOrPorts = urlsOrPorts as ScenarioParams;

    const proxyPorts = _
      .keys(urlsOrPorts)
      .map(name => { return { name, portOrUrl: Helpers.urlParse(urlsOrPorts[name]) } }) as ScenarioParamReturn[];

    const promises = [] as Promise<any>[];
    for (let index = 0; index < proxyPorts.length; index++) {
      let urlOrPort = proxyPorts[index];
      ((promises, proxyURL) => {
        promises.push(new Promise((resolve, reject) => {
          const recordedServerName = ((urlOrPort.name && urlOrPort.name.trim() !== '') ? urlOrPort.name : '').trim();

          Helpers.info(`Starting scenario server on port ${proxyURL.port}
        recorded/assigned server name: ${recordedServerName !== '' ? recordedServerName : '-'}:
        description: "${this.description}"
        `);

          const app = express()
          this.initMidleware(app);
          this.initRequests(app, recordedServerName);
          const h = new http.Server(app);
          h.listen(proxyURL.port, () => {
            console.log(`Server listening on ${proxyURL.href}
            env: ${app.settings.env}
              `);
            resolve(void 0);
          });
        }));
      })(promises, urlOrPort.portOrUrl);

    }
    await Promise.all(promises);
    return proxyPorts;
  }


  tapes(name?: string) {
    const all = glob
      .sync(`${this.location}/**/*__${!!name ? name : ''}*.json5`) as any;
    for (let index = 0; index < all.length; index++) {
      const f = all[index];
      all[index] = Tape.from(Helpers.readJson(f, void 0, true));
    }
    return all as Tape[];
  }

}


export interface RequestType {
  meta: {
    createdAt: string | Date;
    host: string;
  }
}

function respond(allReq, req, res) {

  const match = allReq.find(s => s.matchToReq(req));
  if (match) {
    Helpers.log(`MATCH: ${match.req.method} ${match.req.url}`);
    _.keys(match.res.headers).forEach(headerKey => {
      const headerString = _.isArray(match.res.headers[headerKey]) ?
        ((match.res.headers[headerKey] || []).join(', ')) :
        match.res.headers[headerKey];
      res.set(headerKey, headerString)
    })
    res.send(match.res.body); //.status(match.res.status);
  } else {
    res.send('Dupa NOT MATCH')
  }
}
