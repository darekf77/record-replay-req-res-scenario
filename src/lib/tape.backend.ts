import * as _ from 'lodash';
import * as express from 'express';
import { Tape as BaseTape } from 'ng-talkback';
import json5 from 'json5';

export class Tape implements Partial<BaseTape> {

  static from(data: object) {
    return new Tape(data);
  }

  constructor(data) {
    Object.assign(this, data);
  }

  matchToReq(req: express.Request) {
    return (
      (req.url === this.req.url)
      && (req.method === this.req.method)
      // && (req.body == this.req.body) // TODO
      // && (req.headers == this.req.headers) // TODO
    )
  }


  readonly req: any; // import('ng-talkback/types').Req;
  readonly res?: any; //import('ng-talkback/types').Res;
  readonly options: any; //import('ng-talkback/options').Options;
  readonly queryParamsToIgnore: string[];
  readonly meta: any; // import('ng-talkback/types').Metadata;
  readonly path?: string;
  readonly new: boolean;
  readonly used: boolean;

}
