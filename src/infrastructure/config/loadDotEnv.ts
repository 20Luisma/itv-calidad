import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Carga variables desde un archivo `.env` local sin pisar las ya definidas en `process.env`.
 * Cero dependencias externas y fail-safe si el archivo no existe.
 */
export function loadLocalEnv(baseDir = process.cwd()): void {
  const envPath = path.join(baseDir, '.env');
  let content: string;
  try {
    content = readFileSync(envPath, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (!key || key in process.env) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
