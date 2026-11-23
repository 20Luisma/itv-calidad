#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleListStations, handleRunItv, handleSecurityChecklist } from './handlers.js';

const server = new McpServer({
  name: 'itv-calidad',
  version: '1.0.0'
});

server.tool(
  'list_itv_stations',
  'Lista las 7 estaciones de inspección de ITV de Código (sintaxis, tipos, tests/cobertura, seguridad/OWASP, E2E, WCAG y deuda técnica).',
  {},
  async () => handleListStations()
);

server.tool(
  'run_itv',
  'Ejecuta la ITV de Código completa (7 estaciones) sobre un repositorio local antes de hacer git push o deploy.',
  {
    repoPath: z.string().min(1).describe('Ruta absoluta al repositorio local a inspeccionar'),
    minCoverage: z.number().min(0).max(100).optional().describe('Umbral mínimo de cobertura en % (por defecto 75)'),
    targetUrl: z.string().url().optional().describe('URL local opcional para auditoría WCAG en vivo'),
    format: z.enum(['json', 'markdown']).optional().describe('Formato de salida: json (default) o markdown')
  },
  async (args) => handleRunItv(args)
);

server.tool(
  'get_security_checklist',
  'Ejecuta la auditoría de seguridad (CVEs, secretos, IPs, cabeceras HTTP) y devuelve el Checklist OWASP ASVS / RGPD Art. 32.',
  {
    repoPath: z.string().min(1).describe('Ruta absoluta al repositorio local a auditar')
  },
  async (args) => handleSecurityChecklist(args)
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[itv-calidad MCP] Error fatal: ${msg}`);
  process.exit(1);
});
