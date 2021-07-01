import type ClientResponse from './client/response.js';
import type {JSONValue} from './types.js';
import type WS from 'ws';
import EventEmitter, {on} from 'events';

interface WebSocketEvents {
  close: (code: number, reason: string) => void,
  error: (error: Error) => void,
  message: (message: JSONValue | Buffer) => void,
  ping: (data: Buffer) => void,
  pong: (data: Buffer) => void
}

declare interface WebSocket {
  on: <U extends keyof WebSocketEvents>(event: U, listener: WebSocketEvents[U]) => this,
  emit: <U extends keyof WebSocketEvents>(event: U, ...args: Parameters<WebSocketEvents[U]>) => boolean
}

class WebSocket extends EventEmitter {
  handshake: ClientResponse | null;
  jsonMode: boolean;
  _raw: WS;

  constructor (ws: WS, handshake: ClientResponse | null, options: {jsonMode: boolean}) {
    super({captureRejections: true});

    this.handshake = handshake;
    this.jsonMode = options.jsonMode ?? false;

    this._raw = ws;

    ws.on('error', error => this.emit('error', error));
    ws.on('message', this._safeMessageHandler.bind(this));

    const safeHandler = this._safeHandler;
    ws.on('close', safeHandler.bind(this, 'close'));
    ws.on('ping', safeHandler.bind(this, 'ping'));
    ws.on('pong', safeHandler.bind(this, 'pong'));
  }

  async * [Symbol.asyncIterator] (): AsyncIterableIterator<JSONValue | Buffer> {
    try {
      for await (const [message] of this._messageIterator()) {
        yield message;
      }
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    }
  }

  close (code?: number, reason?: string): void {
    this._raw.close(code, reason);
  }

  async ping (data: Buffer): Promise<void> {
    return await new Promise(resolve => this._raw.ping(data, undefined, () => resolve()));
  }

  async send (message: JSONValue | Buffer): Promise<void> {
    if (!this.jsonMode) return await new Promise(resolve => this._raw.send(message, () => resolve()));
    return new Promise(resolve => this._raw.send(JSON.stringify(message), () => resolve()));
  }

  _messageIterator (): AsyncIterableIterator<Array<JSONValue | Buffer>> {
    // eslint-disable-next-line no-undef
    const ac = new AbortController();

    this._raw.on('close', () => ac.abort());
    return on(this, 'message', {signal: ac.signal});
  }

  _safeHandler <U extends keyof WebSocketEvents>(event: U, ...args: Parameters<WebSocketEvents[U]>): void {
    try {
      this.emit(event, ...args);
    } catch (error) {
      this.emit('error', error);
    }
  }

  _safeMessageHandler (message: string | Buffer): void {
    try {
      if (!this.jsonMode) {
        this.emit('message', message);
      } else {
        this.emit('message', JSON.parse(message.toString()));
      }
    } catch (error) {
      this.emit('error', error);
    }
  }
}

export default WebSocket;
