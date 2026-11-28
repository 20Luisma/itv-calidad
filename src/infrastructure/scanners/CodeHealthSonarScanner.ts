import { access } from 'node:fs/promises';
import path from 'node:path';
import type { Finding } from '../../domain/types.js';
import { walkRepoFiles } from '../fs/RepoFileWalker.js';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.php', '.py', '.cs', '.go', '.dart']);

const MAX_FILE_LINES = 500;
const MAX_COMPLEXITY_PER_FILE = 85;
const DUPLICATE_WINDOW_LINES = 8;

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function isTestOrScannerFile(relativePath: string): boolean {
  const norm = relativePath.replace(/\\/g, '/');
  return (
    norm.startsWith('tests/') ||
    norm.startsWith('test/') ||
    norm.includes('.test.') ||
    norm.includes('.spec.') ||
    norm.includes('CodeHealthSonarScanner')
  );
}

export function estimateCyclomaticComplexity(content: string): number {
  const matches = content.match(
    /\b(?:if|else\s+if|for|while|case|catch|elif|except)\b|&&|\|\||\?(?!\.)/g
  );
  return 1 + (matches ? matches.length : 0);
}

function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

export async function scanCodeHealthSonar(repoPath: string): Promise<{
  filesAnalyzed: number;
  duplicateBlocks: number;
  hasSonarConfig: boolean;
  findings: Finding[];
}> {
  const [allFiles, hasSonarConfig] = await Promise.all([
    walkRepoFiles(repoPath, SOURCE_EXTENSIONS, 250),
    exists(path.join(repoPath, 'sonar-project.properties'))
  ]);

  const files = allFiles.filter((f) => !isTestOrScannerFile(f.relativePath));
  const findings: Finding[] = [];
  const seenBlocks = new Map<string, { file: string; line: number }>();
  const reportedDuplicates = new Set<string>();
  let duplicateBlocks = 0;

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);

    // 1. Archivos monolíticos (God Files)
    if (lines.length > MAX_FILE_LINES) {
      findings.push({
        severity: 'warning',
        title: `Archivo demasiado extenso (${lines.length} líneas > ${MAX_FILE_LINES})`,
        file: file.relativePath,
        line: 1,
        reason: 'Los archivos monolíticos dificultan las revisiones, tests unitarios y elevan el riesgo de regresiones.',
        howToFix: 'Dividí responsabilidades en módulos o componentes más pequeños (Principio de Responsabilidad Única).'
      });
    }

    // 2. Complejidad ciclomática alta
    const complexity = estimateCyclomaticComplexity(file.content);
    if (complexity > MAX_COMPLEXITY_PER_FILE) {
      findings.push({
        severity: 'warning',
        title: `Complejidad ciclomática elevada (${complexity} ramas de decisión)`,
        file: file.relativePath,
        line: 1,
        reason: 'Muchas ramas condicionales anidadas disparan los bugs en casos borde (regla típica de Sonar).',
        howToFix: 'Extraé funciones puras, usá guard clauses (retornos tempranos) o mapas de estrategia en vez de `if/else` largos.'
      });
    }

    // 3. Restos de depuración olvidados (debugger; / var_dump / dd)
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      if (/^\s*(?:\/\/|#|\/\*|\*)/.test(line)) continue;

      if (/^\s*debugger\s*;?\s*(?:\/\/.*)?$/.test(line)) {
        findings.push({
          severity: 'error',
          title: 'Sentencia `debugger` olvidada en el código',
          file: file.relativePath,
          line: i + 1,
          reason: 'Un `debugger` en código de producción pausa la ejecución en navegadores con DevTools abiertos.',
          howToFix: 'Eliminá la línea `debugger` antes de hacer `git push`.'
        });
      }

      if (file.relativePath.endsWith('.php') && /\b(?:var_dump|dd)\s*\(/.test(line)) {
        findings.push({
          severity: 'warning',
          title: 'Volcado de debug PHP (`var_dump` / `dd`) detectado',
          file: file.relativePath,
          line: i + 1,
          reason: 'Puede filtrar estructuras internas o romper respuestas JSON en producción.',
          howToFix: 'Eliminá `var_dump`/`dd` y usá un logger estructurado si necesitás trazas.'
        });
      }
    }

    // 4. Detección de bloques duplicados entre distintos archivos (ventana de 8 líneas no triviales)
    const meaningful: { text: string; line: number }[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const norm = normalizeLine(lines[i] ?? '');
      if (norm.length >= 16 && !norm.startsWith('import ') && !norm.startsWith('use ') && !norm.startsWith('//')) {
        meaningful.push({ text: norm, line: i + 1 });
      }
    }

    for (let i = 0; i <= meaningful.length - DUPLICATE_WINDOW_LINES; i += 1) {
      const block = meaningful
        .slice(i, i + DUPLICATE_WINDOW_LINES)
        .map((m) => m.text)
        .join('\n');
      const existing = seenBlocks.get(block);
      const currentLine = meaningful[i]?.line ?? 1;

      if (!existing) {
        seenBlocks.set(block, { file: file.relativePath, line: currentLine });
      } else if (existing.file !== file.relativePath) {
        const pairKey = [existing.file, file.relativePath].sort().join('::');
        if (!reportedDuplicates.has(pairKey)) {
          reportedDuplicates.add(pairKey);
          duplicateBlocks += 1;
          findings.push({
            severity: 'warning',
            title: 'Bloque de código duplicado entre archivos (DRY / Sonar)',
            file: file.relativePath,
            line: currentLine,
            reason: `Bloque idéntico de ${DUPLICATE_WINDOW_LINES}+ líneas ya aparece en \`${existing.file}:${existing.line}\`.`,
            howToFix: 'Extraé la lógica repetida a un helper o módulo compartido para evitar corregir el mismo bug dos veces.'
          });
        }
      }
    }
  }

  return {
    filesAnalyzed: files.length,
    duplicateBlocks,
    hasSonarConfig,
    findings
  };
}
