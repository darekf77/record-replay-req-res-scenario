import BaseTape from 'talkback/tape';

export class Tape implements Partial<BaseTape> {

  static from(data: object) {
    return new Tape(data);
  }

  constructor(data) {
    Object.assign(this, data);
  }

  req: import('talkback/types').Req;
  res?: import('talkback/types').Res;
  options: import('talkback/options').Options;
  queryParamsToIgnore: string[];
  meta: import('talkback/types').Metadata;
  path?: string;
  new: boolean;
  used: boolean;

}
