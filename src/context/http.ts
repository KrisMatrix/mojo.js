import type App from '../app.js';
import type File from '../file.js';
import type {MojoAction, MojoStash, RenderOptions} from '../types.js';
import type ServerRequest from '../server/request.js';
import Context from '../context.js';
import ServerResponse from '../server/response.js';

export default class HTTPContext extends Context {
  res: ServerResponse;
  constructor (app: App, req: ServerRequest, res: ServerResponse, options: MojoStash) {
    super(app, req, options);
    this.res = new ServerResponse(res, this);
  }

  accepts (...allowed: string[]): [string] {
    const formats = this.app.mime.detect(this.req.get('Accept') ?? '');
    const stash = this.stash as MojoStash;
    if (typeof stash.ext === 'string') formats.unshift(stash.ext);

    if (allowed === undefined) return formats.length > 0 ? formats : null;

    const results = formats.filter((format: string) => allowed.includes(format));
    return results.length > 0 ? results : null;
  }

  async redirectTo (target: string, options: {status?: number, values?: string} = {}): Promise<void> {
    await this.res.status(options.status ?? 302).set('Location', this.urlFor(target, options.values)).send();
  }

  async render (options: RenderOptions = {}, stash: MojoStash = {}): Promise<boolean> {
    if (typeof options === 'string') options = {view: options};
    if (stash !== undefined) Object.assign(this.stash, stash);

    const app = this.app;
    const result = await app.renderer.render(this, options);
    if (result === null) {
      if (options.maybe !== true) throw new Error('Nothing could be rendered');
      return false;
    }

    const res = this.res;
    if (res.isSent) return false;
    if (options.status !== undefined) res.status(options.status);
    const type = app.mime.extType(result.format) ?? 'application/octet-stream';
    await res.type(type).send(result.output);

    return true;
  }

  async renderToString (options: RenderOptions, stash: MojoStash): Promise<string> {
    if (typeof options === 'string') options = {view: options};
    Object.assign(this.stash, stash);
    const result = await this.app.renderer.render(this, options);
    return result === null ? null : result.output.toString();
  }

  async respondTo (spec: {[key: string]: MojoAction}): Promise<void> {
    const formats = this.accepts() ?? [];

    for (const format of formats) {
      if (spec[format] === undefined) continue;
      await spec[format](this);
      return;
    }

    if (spec.any !== undefined) {
      await spec.any(this);
      return;
    }

    await this.res.status(204).send();
  }

  sendFile (file: File): boolean {
    return this.app.static.serveFile(this, file);
  }
}
