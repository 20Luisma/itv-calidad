import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportReportAsMarkdown } from '../../application/ExportReportMarkdown.js';
import { RunItvInspection } from '../../application/RunItvInspection.js';
import { ORDERED_STATION_IDS, STATION_CATALOG } from '../../domain/catalog.js';
import type { CommandExecutor, InspectionReport, StationRunner } from '../../domain/types.js';
import {
  getIntegrationsStatus,
  saveIntegrationsEnv,
  type IntegrationsUpdatePayload
} from '../../infrastructure/config/loadDotEnv.js';
import { pickNativeFolder } from '../../infrastructure/exec/NativeFolderPicker.js';
import { SafeCommandExecutor } from '../../infrastructure/exec/SafeCommandExecutor.js';
import { createDefaultStations } from '../../infrastructure/stations/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_DIR = path.resolve(__dirname, '../../../public');

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self';"
  );
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  applySecurityHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf8');
      if (data.length > maxBytes) {
        reject(new Error('Payload demasiado grande.'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export interface WebServerDependencies {
  readonly publicDir?: string;
  readonly defaultRepoPath?: string;
  readonly envDir?: string;
  readonly stations?: readonly StationRunner[];
  readonly executor?: CommandExecutor;
  readonly pickFolder?: () => Promise<string | null>;
}

export function createWebServer(deps: WebServerDependencies = {}): Server {
  const publicDir = deps.publicDir ?? DEFAULT_PUBLIC_DIR;
  const defaultRepoPath = deps.defaultRepoPath ?? process.cwd();
  const envDir = deps.envDir ?? process.cwd();
  const executor = deps.executor ?? new SafeCommandExecutor();
  const stations = deps.stations ?? createDefaultStations();
  const pickFolder = deps.pickFolder ?? (() => pickNativeFolder(executor));
  const inspectionUseCase = new RunItvInspection(stations, executor);

  return createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://localhost');
      const pathname = requestUrl.pathname;

      // 1. Health + configuración local inicial
      if (req.method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, {
          status: 'ok',
          version: '1.0.0',
          defaultRepoPath
        });
        return;
      }

      // 2. Catálogo didáctico de estaciones
      if (req.method === 'GET' && pathname === '/api/stations') {
        const list = ORDERED_STATION_IDS.map((id) => STATION_CATALOG[id]);
        sendJson(res, 200, { stations: list });
        return;
      }

      // 2b. Selector nativo de carpeta local (Finder en macOS)
      if (req.method === 'POST' && pathname === '/api/pick-folder') {
        const selectedPath = await pickFolder();
        if (!selectedPath) {
          sendJson(res, 200, { cancelled: true });
          return;
        }
        sendJson(res, 200, { cancelled: false, path: selectedPath });
        return;
      }

      // 2c. Estado y guardado seguro de integraciones (SonarCloud, Sentry, GitHub) — nunca devuelve tokens
      if (req.method === 'GET' && pathname === '/api/integrations') {
        sendJson(res, 200, getIntegrationsStatus());
        return;
      }

      if (req.method === 'POST' && pathname === '/api/integrations') {
        const raw = await readBody(req, 64 * 1024);
        let payload: IntegrationsUpdatePayload;
        try {
          payload = JSON.parse(raw) as IntegrationsUpdatePayload;
        } catch {
          sendJson(res, 400, { error: 'JSON inválido para integraciones.' });
          return;
        }
        const updated = await saveIntegrationsEnv(payload, envDir);
        sendJson(res, 200, updated);
        return;
      }

      // 3. Stream SSE en cámara lenta de la ITV
      if (req.method === 'GET' && pathname === '/api/inspect/stream') {
        const repoPath = (requestUrl.searchParams.get('repoPath') ?? defaultRepoPath).trim();
        const targetUrl = (requestUrl.searchParams.get('targetUrl') ?? '').trim();
        const slowMotionParam = Number(requestUrl.searchParams.get('slowMotionMs') ?? '900');
        const minCoverageParam = Number(requestUrl.searchParams.get('minCoverage') ?? '75');

        const slowMotionMs =
          Number.isFinite(slowMotionParam) && slowMotionParam >= 0 && slowMotionParam <= 5000
            ? slowMotionParam
            : 900;
        const minCoverage =
          Number.isFinite(minCoverageParam) && minCoverageParam >= 0 && minCoverageParam <= 100
            ? minCoverageParam
            : 75;

        applySecurityHeaders(res);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive'
        });

        const controller = new AbortController();
        req.on('close', () => {
          controller.abort();
        });

        const sendEvent = (eventName: string, data: unknown) => {
          if (res.writableEnded) return;
          res.write(`event: ${eventName}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
          await inspectionUseCase.execute(
            {
              repoPath,
              slowMotionMs,
              minCoverage,
              ...(targetUrl ? { targetUrl } : {}),
              signal: controller.signal
            },
            (event) => {
              sendEvent(event.type, event);
            }
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error ejecutando la inspección.';
          sendEvent('inspection:error', { type: 'inspection:error', message });
        } finally {
          if (!res.writableEnded) {
            res.end();
          }
        }
        return;
      }

      // 4. Exportación de evidencia en Markdown
      if (req.method === 'POST' && pathname === '/api/export/markdown') {
        const raw = await readBody(req);
        let parsed: InspectionReport;
        try {
          parsed = JSON.parse(raw) as InspectionReport;
        } catch {
          sendJson(res, 400, { error: 'JSON de reporte inválido.' });
          return;
        }
        if (!parsed || !Array.isArray(parsed.stations) || !parsed.stack) {
          sendJson(res, 400, { error: 'Estructura de reporte incompleta.' });
          return;
        }

        const markdown = exportReportAsMarkdown(parsed);
        applySecurityHeaders(res);
        res.writeHead(200, {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="itv-evidencia-${parsed.stack.repoName}.md"`
        });
        res.end(markdown);
        return;
      }

      // 5. Archivos estáticos de public/ (con protección contra path traversal)
      if (req.method === 'GET') {
        const relativeFile = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const resolved = path.resolve(publicDir, relativeFile);
        if (!resolved.startsWith(publicDir + path.sep) && resolved !== publicDir) {
          sendJson(res, 403, { error: 'Acceso denegado.' });
          return;
        }

        try {
          const content = await readFile(resolved);
          const ext = path.extname(resolved).toLowerCase();
          applySecurityHeaders(res);
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream'
          });
          res.end(content);
          return;
        } catch {
          sendJson(res, 404, { error: 'Recurso no encontrado.' });
          return;
        }
      }

      sendJson(res, 405, { error: 'Método no permitido.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno del servidor.';
      sendJson(res, 500, { error: message });
    }
  });
}
