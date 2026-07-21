import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export class HealthServer {
  private server?: Server;
  private accepting = true;

  public constructor(
    private readonly port: number,
    private readonly host: string,
    private ready = false,
  ) {}

  public setReady(value: boolean): void {
    this.ready = value;
  }

  public get address(): AddressInfo | undefined {
    const value = this.server?.address();
    return value && typeof value !== 'string' ? value : undefined;
  }

  public async start(): Promise<void> {
    this.server = createServer((request, response) => {
      const status =
        request.url === '/healthz' && this.accepting
          ? 200
          : request.url === '/readyz' && this.accepting && this.ready
            ? 200
            : 503;
      if (request.url !== '/healthz' && request.url !== '/readyz') {
        response.writeHead(404).end();
        return;
      }
      response
        .writeHead(status, { 'content-type': 'application/json' })
        .end(JSON.stringify({ status: status === 200 ? 'ok' : 'not_ready' }));
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.port, this.host, () => resolve());
    });
  }

  public async stop(): Promise<void> {
    this.accepting = false;
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
  }
}
