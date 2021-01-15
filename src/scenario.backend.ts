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
    if (!Scenario.instances[pathToScenario]) {
      Scenario.instances[pathToScenario] = new Scenario(pathToScenario)
    }
    return Scenario.instances[pathToScenario] as Scenario;
  }

  get basename() {
    return path.basename(this.location);
  }
  public get description() {
    return this.packageJson?.description ? this.packageJson?.description : _.startCase(this.packageJson?.name);
  }
  private packageJson: Models.npm.IPackageJSON;
  constructor(
    private readonly location: string
  ) {
    const pathToScenarioPackageJson = path.join(location, config.file.package_json);
    // Helpers.log(`path to scenario pj: ${pathToScenarioPackageJson}`)
    this.packageJson = Helpers.readJson(pathToScenarioPackageJson);
  }

  private app: Application;
  private initMidleware() {
    const app = this.app;
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

  private respond(allReq, req, res) {

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

  private initRequests() {
    const app = this.app;
    const allReq = this.tapes;

    app.get(/^\/(.*)/, (req, res) => {
      this.respond(allReq, req, res);
    });
    app.post(/^\/(.*)/, (req, res) => {
      this.respond(allReq, req, res);
    });
    app.delete(/^\/(.*)/, (req, res) => {
      this.respond(allReq, req, res);
    });
    app.put(/^\/(.*)/, (req, res) => {
      this.respond(allReq, req, res);
    });
    app.head(/^\/(.*)/, (req, res) => {
      this.respond(allReq, req, res);
    });
  }

  async start(url: URL) {
    this.app = express()
    this.initMidleware();
    this.initRequests();
    const h = new http.Server(this.app);
    h.listen(url.port, () => {
      console.log(`Server listening on port: ${url.port}, hostname: ${url.pathname},
          env: ${this.app.settings.env}
          `);
    });
  }


  get tapes() {
    const all = glob
      .sync(`${this.location}/**/*.json5`) as any;
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
