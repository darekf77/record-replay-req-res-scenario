import * as express from 'express';
import { Tape as BaseTape } from 'ng-talkback';

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
      // && (req.body == this.req.body)
    )
  }


  req: import('ng-talkback/types').Req;
  res?: import('ng-talkback/types').Res;
  options: import('ng-talkback/options').Options;
  queryParamsToIgnore: string[];
  meta: import('ng-talkback/types').Metadata;
  path?: string;
  new: boolean;
  used: boolean;

}
