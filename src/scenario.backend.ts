import { Application } from 'express';
import * as _ from 'lodash';
import * as glob from 'glob';
import * as path from 'path';
import * as fse from 'fs-extra';
import * as express from 'express';
import * as http from 'http';
import * as  cors from 'cors';
import * as bodyParser from 'body-parser';
import * as errorHandler from 'errorhandler';
import * as cookieParser from 'cookie-parser';
import * as methodOverride from 'method-override';
import * as fileUpload from 'express-fileupload';
import { createConnection, createConnections, getConnection } from 'typeorm';
import { Connection } from 'typeorm';
import { CLASS } from 'typescript-class-helpers';
import { Models } from 'tnp-models';
import { Helpers } from 'tnp-helpers';
import { config } from 'tnp-config';
import { Http2Server } from 'http2';
import { URL } from 'url';
import { Tape } from './tape.backend';

export class Scenario {

  static From(pathToScenario: string) {

    return new Scenario(pathToScenario);
  }

  get basename() {
    return path.basename(this.location);
  }
  get description() {
    return this.packageJson?.description ? this.packageJson?.description : _.startCase(this.packageJson?.name);
  }
  private packageJson: Models.npm.IPackageJSON;
  constructor(
    private readonly location: string
  ) {
    this.packageJson = Helpers.readJson(path.join(location, config.file.package_json));
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

  private initRequests() {
    const app = this.app;
    const allReq = this.requests;
    for (let index = 0; index < allReq.length; index++) {
      const element = allReq[index];
      (() => {
        app.use((req, res, next) => {
          // @LAST compare
          next();
        });
      })();
    }

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


  get requests() {
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
