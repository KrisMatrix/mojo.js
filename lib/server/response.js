import cookie from 'cookie';
import EventEmitter from 'events';
import Stream from 'stream';

export default class ServerResponse extends EventEmitter {
  constructor (res) {
    super();
    this.isSent = false;
    this.raw = res;
    this._headers = {};
    this._status = undefined;
  }

  length (len) {
    this._headers['Content-Length'] = len;
    return this;
  }

  set (name, value) {
    if (this._headers[name] !== undefined && name === 'Set-Cookie') {
      if (typeof this._headers[name] === 'string') this._headers[name] = [this._headers[name]];
      this._headers[name].push(value);
    } else {
      this._headers[name] = value;
    }
    return this;
  }

  send (body) {
    this.emit('send');

    const raw = this.raw;
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      this.length(Buffer.byteLength(body));
      raw.writeHead(this._status, this._headers, null);
      raw.end(body, null, null);
    } else if (body instanceof Stream) {
      raw.writeHead(this._status, this._headers, null);
      body.pipe(this.raw);
    } else {
      raw.writeHead(this._status, this._headers, null);
      raw.end(null, null, null);
    }
    this.isSent = true;
  }

  setCookie (name, value, options) {
    return this.set('Set-Cookie', cookie.serialize(name, value, options));
  }

  status (code) {
    this._status = code;
    return this;
  }

  type (type) {
    this._headers['Content-Type'] = type;
    return this;
  }
}
