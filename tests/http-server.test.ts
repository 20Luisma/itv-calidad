import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { CommandExecutor, CommandResult } from '../src/domain/types.js';
import { createWebServer } from '../src/interfaces/web/httpApp.js';

class AlwaysPassExecutor implements CommandExecutor {
  async run(binary: string, args: readonly string[]): Promise<CommandResult> {
    return {
      command: [binary, ...args].join(' '),
      exitCode: 0,
      stdout: 'All files | 91.00 |',
      stderr: '',
      durationMs: 2,
      timedOut: false,
      notFound: false
    };
  }
}

let activeServer: ReturnType<typeof createWebServer> | null = null;

afterEach(async () => {
  if (activeServer) {
    await new Promise<void>((resolve) => activeServer?.close(() => resolve()));
    activeServer = null;
  }
});

async function startTestServer(): Promise<string> {
  activeServer = createWebServer({
    executor: new AlwaysPassExecutor(),
    defaultRepoPath: process.cwd(),
    pickFolder: async () => '/Users/admin/Desktop/Proyectos/demo'
  });
  await new Promise<void>((resolve) => activeServer?.listen(0, '127.0.0.1', () => resolve()));
  const addr = activeServer.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

describe('HTTP & SSE Web Server', () => {
  it('responde /api/health y /api/stations con cabeceras de seguridad HTTP', async () => {
    const baseUrl = await startTestServer();

    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    expect(healthRes.headers.get('x-content-type-options')).toBe('nosniff');
    expect(healthRes.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(healthRes.headers.get('content-security-policy')).toContain("script-src 'self'");

    const health = (await healthRes.json()) as { status: string };
    expect(health.status).toBe('ok');

    const stationsRes = await fetch(`${baseUrl}/api/stations`);
    const stationsJson = (await stationsRes.json()) as { stations: unknown[] };
    expect(stationsJson.stations).toHaveLength(6);
  });

  it('bloquea intentos de path traversal en archivos estáticos', async () => {
    const baseUrl = await startTestServer();
    const res = await fetch(`${baseUrl}/..%2fpackage.json`);
    expect([403, 404]).toContain(res.status);
  });

  it('streamea eventos SSE completos en /api/inspect/stream', async () => {
    const baseUrl = await startTestServer();
    const url = `${baseUrl}/api/inspect/stream?repoPath=${encodeURIComponent(process.cwd())}&slowMotionMs=0`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const body = await res.text();
    expect(body).toContain('event: inspection:start');
    expect(body).toContain('event: station:complete');
    expect(body).toContain('event: inspection:complete');
  });

  it('responde POST /api/pick-folder devolviendo la carpeta elegida', async () => {
    const baseUrl = await startTestServer();
    const res = await fetch(`${baseUrl}/api/pick-folder`, { method: 'POST' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { cancelled: boolean; path: string };
    expect(json.cancelled).toBe(false);
    expect(json.path).toBe('/Users/admin/Desktop/Proyectos/demo');
  });
});
