#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleListStations, handleRunItv, handleSecurityChecklist } from './handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_URI = 'ui://itv-calidad/app.html';
const APP_MIME = 'text/html;profile=mcp-app';

async function loadMcpAppHtml(): Promise<string> {
  const candidates = [
    path.join(__dirname, 'app.html'),
    path.resolve(__dirname, '../../../dist/interfaces/mcp/app.html')
  ];
  for (const filePath of candidates) {
    try {
      const html = await readFile(filePath, 'utf8');
      if (html.trim().length > 0) return html;
    } catch {
      // probar siguiente ruta
    }
  }
  return '<!doctype html><html lang="es"><body><p>Ejecutá <code>npm run build</code> para compilar la UI de la MCP App.</p></body></html>';
}

const server = new McpServer({
  name: 'itv-calidad',
  version: '1.1.0'
});

server.registerResource(
  'itv-dashboard-app',
  APP_URI,
  {
    title: 'ITV de Código — Cabina Interactiva',
    description: 'Interfaz visual interactiva de las 7 estaciones de ITV de Código.',
    mimeType: APP_MIME,
    _meta: {
      ui: {
        prefersBorder: false
      }
    }
  },
  async () => ({
    contents: [
      {
        uri: APP_URI,
        mimeType: APP_MIME,
        text: await loadMcpAppHtml()
      }
    ]
  })
);

server.registerTool(
  'list_itv_stations',
  {
    title: 'Listar Estaciones ITV',
    description:
      'Lista las 7 estaciones de inspección de ITV de Código (sintaxis, tipos, tests/cobertura, seguridad/OWASP, E2E, WCAG y deuda técnica).',
    inputSchema: {}
  },
  async () => handleListStations()
);

server.registerTool(
  'run_itv',
  {
    title: 'ITV de Código',
    description:
      'Ejecuta la ITV de Código completa (7 estaciones) sobre un repositorio local antes de hacer git push o deploy, y renderiza la cabina visual interactiva.',
    inputSchema: {
      repoPath: z
        .string()
        .optional()
        .describe('Ruta absoluta al repositorio local a inspeccionar (opcional al abrir el panel)'),
      minCoverage: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe('Umbral mínimo de cobertura en % (por defecto 75)'),
      targetUrl: z.string().url().optional().describe('URL local opcional para auditoría WCAG en vivo'),
      format: z.enum(['json', 'markdown']).optional().describe('Formato de salida: json (default) o markdown')
    },
    _meta: {
      ui: {
        resourceUri: APP_URI
      },
      'com.google.antigravity/ui': {
        entrypoints: [
          { type: 'aux_pane', title: 'ITV de Código' },
          { type: 'global', title: 'ITV de Código' }
        ]
      }
    }
  },
  async (args) => handleRunItv(args)
);

server.registerTool(
  'get_security_checklist',
  {
    title: 'Checklist de Seguridad OWASP / RGPD',
    description:
      'Ejecuta la auditoría de seguridad (CVEs, secretos, IPs, cabeceras HTTP) y devuelve el Checklist OWASP ASVS / RGPD Art. 32.',
    inputSchema: {
      repoPath: z.string().min(1).describe('Ruta absoluta al repositorio local a auditar')
    }
  },
  async (args) => handleSecurityChecklist(args)
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[itv-calidad MCP App] Servidor listo por stdio con UI interactiva.');
}

main().catch((error) => {
  console.error('[itv-calidad MCP] Error fatal:', error);
  process.exit(1);
});
