import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'vendor',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  'memory_backups'
]);

const MAX_FILE_BYTES = 512 * 1024;

export interface ScannedFile {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly content: string;
}

export async function walkRepoFiles(
  repoPath: string,
  allowedExtensions: ReadonlySet<string>,
  maxFiles = 400
): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];

  async function visit(currentDir: string): Promise<void> {
    if (results.length >= maxFiles) return;

    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) break;

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await visit(path.join(currentDir, entry.name));
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExtensions.has(ext)) continue;

      const absolutePath = path.join(currentDir, entry.name);
      try {
        const info = await stat(absolutePath);
        if (info.size > MAX_FILE_BYTES) continue;
        const content = await readFile(absolutePath, 'utf8');
        results.push({
          absolutePath,
          relativePath: path.relative(repoPath, absolutePath),
          content
        });
      } catch {
        // Ignorar archivos ilegibles sin romper la inspección.
      }
    }
  }

  await visit(repoPath);
  return results;
}
