import { access, chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CommandExecutor } from '../domain/types.js';

export interface InitHookResult {
  readonly hookPath: string;
  readonly created: boolean;
  readonly alreadyExisted: boolean;
  readonly gitHooksConfigured: boolean;
  readonly message: string;
}

const HOOK_CONTENT = `#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
echo "🛡️ [pre-push] Ejecutando ITV de Código (7 estaciones) antes de git push..."

if command -v npx >/dev/null 2>&1; then
  npx -y itv-calidad "$REPO_ROOT" --fast
else
  echo "⚠️  npx no encontrado en PATH. Instala Node.js >= 20 para ejecutar ITV de Código." >&2
  exit 1
fi
`;

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function initPrePushHook(
  rawRepoPath: string,
  executor: CommandExecutor,
  force = false
): Promise<InitHookResult> {
  const repoPath = path.resolve(rawRepoPath);
  const hooksDir = path.join(repoPath, '.githooks');
  const hookPath = path.join(hooksDir, 'pre-push');

  const existed = await pathExists(hookPath);
  if (existed && !force) {
    return {
      hookPath,
      created: false,
      alreadyExisted: true,
      gitHooksConfigured: false,
      message: `Ya existe un hook en ${hookPath}. Usa --force si deseas sobrescribirlo.`
    };
  }

  await mkdir(hooksDir, { recursive: true });
  await writeFile(hookPath, HOOK_CONTENT, 'utf8');
  await chmod(hookPath, 0o755);

  const isGitRepo = await pathExists(path.join(repoPath, '.git'));
  let gitHooksConfigured = false;
  if (isGitRepo) {
    const res = await executor.run('git', ['config', 'core.hooksPath', '.githooks'], {
      cwd: repoPath,
      timeoutMs: 10_000
    });
    gitHooksConfigured = res.exitCode === 0;
  }

  const message = gitHooksConfigured
    ? `Hook pre-push instalado en ${hookPath} y activado (core.hooksPath=.githooks).`
    : `Hook pre-push creado en ${hookPath}. Ejecuta \`git config core.hooksPath .githooks\` tras \`git init\`.`;

  return {
    hookPath,
    created: true,
    alreadyExisted: existed,
    gitHooksConfigured,
    message
  };
}
