import http from 'node:http';
import { EventEmitter } from 'node:events';
import { adaptIncoming } from './adapter';
import type { Payload } from '../shared/payload';

const PORT_BASE = 40429;
const MAX_FALLBACK = 10;
const MAX_BODY = 10_000; // 10KB. webhook-server 스킬 보안 원칙
const HOST = '127.0.0.1'; // 절대 변경 금지 — 외부 IP 바인딩 시 위젯 조작 가능

interface WebhookEvents {
  payload: (p: Payload) => void;
  'port-changed': (port: number) => void;
}

export declare interface WebhookServer {
  on<K extends keyof WebhookEvents>(e: K, l: WebhookEvents[K]): this;
  emit<K extends keyof WebhookEvents>(e: K, ...args: Parameters<WebhookEvents[K]>): boolean;
}

export class WebhookServer extends EventEmitter {
  private server?: http.Server;
  public port?: number;

  constructor(private readonly token?: string) {
    super();
  }

  async start(): Promise<number> {
    let lastErr: unknown;
    for (let i = 0; i < MAX_FALLBACK; i++) {
      const port = PORT_BASE + i;
      try {
        await this.bind(port);
        this.port = port;
        this.emit('port-changed', port);
        return port;
      } catch (e) {
        lastErr = e;
        if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw e;
      }
    }
    throw new Error(
      `No available port in ${PORT_BASE}..${PORT_BASE + MAX_FALLBACK - 1}: ${String(lastErr)}`,
    );
  }

  async stop(): Promise<void> {
    const s = this.server;
    if (!s) return;
    await new Promise<void>((resolve) => s.close(() => resolve()));
    this.server = undefined;
    this.port = undefined;
  }

  async restart(): Promise<number> {
    await this.stop();
    return this.start();
  }

  private bind(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const srv = http.createServer((req, res) => this.handle(req, res));
      srv.once('error', reject);
      srv.listen(port, HOST, () => {
        this.server = srv;
        srv.removeListener('error', reject);
        resolve();
      });
    });
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method !== 'POST' || req.url !== '/event') {
      res.writeHead(404);
      res.end();
      return;
    }

    if (this.token) {
      const auth = req.headers['authorization'];
      if (auth !== `Bearer ${this.token}`) {
        res.writeHead(401);
        res.end();
        return;
      }
    }

    let body = '';
    let aborted = false;

    req.on('data', (chunk: Buffer) => {
      body += chunk;
      if (body.length > MAX_BODY) {
        aborted = true;
        res.writeHead(413);
        res.end('payload too large');
        req.destroy();
      }
    });

    req.on('end', () => {
      if (aborted) return;

      let raw: unknown;
      try {
        raw = JSON.parse(body);
      } catch {
        res.writeHead(400);
        res.end('invalid json');
        return;
      }

      const payload = adaptIncoming(raw);
      if (!payload) {
        res.writeHead(422);
        res.end('unrecognized payload');
        return;
      }

      this.emit('payload', payload);
      res.writeHead(204);
      res.end();
    });

    req.on('error', (err) => {
      console.error('[webhook] request error:', err.message);
    });
  }
}
