import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RepoStack, StackKind } from '../domain/types.js';

interface PackageJsonShape {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface ComposerJsonShape {
  scripts?: Record<string, string | string[]>;
  require?: Record<string, string>;
  'require-dev'?: Record<string, string>;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function readGitBranch(repoPath: string): Promise<string | undefined> {
  try {
    const headContent = (await readFile(path.join(repoPath, '.git', 'HEAD'), 'utf8')).trim();
    const refPrefix = 'ref: refs/heads/';
    if (headContent.startsWith(refPrefix)) {
      return headContent.slice(refPrefix.length);
    }
    return headContent.slice(0, 7) || undefined;
  } catch {
    return undefined;
  }
}

function normalizeComposerScripts(
  scripts: Record<string, string | string[]> | undefined
): Record<string, string> {
  if (!scripts) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(scripts)) {
    if (typeof value === 'string') {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.join(' && ');
    }
  }
  return result;
}

export async function detectRepoStack(rawRepoPath: string): Promise<RepoStack> {
  const trimmed = rawRepoPath.trim();
  if (!trimmed) {
    throw new Error('Debés indicar una ruta de repositorio válida.');
  }

  const resolvedPath = path.resolve(trimmed);
  let stats;
  try {
    stats = await stat(resolvedPath);
  } catch {
    throw new Error(`La ruta no existe o no es accesible: ${resolvedPath}`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`La ruta indicada no es un directorio: ${resolvedPath}`);
  }

  const [
    hasPackageJson,
    hasComposerJson,
    hasTsConfig,
    hasPyproject,
    hasRequirements,
    hasSetupPy,
    hasPlaywrightTs,
    hasPlaywrightJs,
    hasPlaywrightMjs,
    hasPa11yRc,
    hasLighthouserc,
    gitBranch
  ] = await Promise.all([
    pathExists(path.join(resolvedPath, 'package.json')),
    pathExists(path.join(resolvedPath, 'composer.json')),
    pathExists(path.join(resolvedPath, 'tsconfig.json')),
    pathExists(path.join(resolvedPath, 'pyproject.toml')),
    pathExists(path.join(resolvedPath, 'requirements.txt')),
    pathExists(path.join(resolvedPath, 'setup.py')),
    pathExists(path.join(resolvedPath, 'playwright.config.ts')),
    pathExists(path.join(resolvedPath, 'playwright.config.js')),
    pathExists(path.join(resolvedPath, 'playwright.config.mjs')),
    pathExists(path.join(resolvedPath, '.pa11yci')),
    pathExists(path.join(resolvedPath, 'lighthouserc.json')),
    readGitBranch(resolvedPath)
  ]);

  const pkg = hasPackageJson
    ? await readJsonSafe<PackageJsonShape>(path.join(resolvedPath, 'package.json'))
    : null;
  const composer = hasComposerJson
    ? await readJsonSafe<ComposerJsonShape>(path.join(resolvedPath, 'composer.json'))
    : null;

  const hasPythonProject = hasPyproject || hasRequirements || hasSetupPy;
  const detectedStacks: StackKind[] = [];
  if (hasPackageJson) detectedStacks.push('node');
  if (hasComposerJson) detectedStacks.push('php');
  if (hasPythonProject) detectedStacks.push('python');

  const allNodeDeps = {
    ...(pkg?.dependencies ?? {}),
    ...(pkg?.devDependencies ?? {})
  };
  const packageScripts = pkg?.scripts ?? {};
  const composerScripts = normalizeComposerScripts(composer?.scripts);

  const hasTypeScript = hasTsConfig || 'typescript' in allNodeDeps;
  const hasPlaywright =
    hasPlaywrightTs ||
    hasPlaywrightJs ||
    hasPlaywrightMjs ||
    '@playwright/test' in allNodeDeps ||
    'playwright' in allNodeDeps ||
    'test:e2e' in packageScripts ||
    'e2e' in packageScripts;

  const hasAccessibilityTooling =
    hasPa11yRc ||
    hasLighthouserc ||
    '@axe-core/playwright' in allNodeDeps ||
    'pa11y' in allNodeDeps ||
    'pa11y-ci' in allNodeDeps ||
    '@lhci/cli' in allNodeDeps ||
    'lighthouse' in allNodeDeps ||
    'test:a11y' in packageScripts ||
    'a11y' in packageScripts;

  // Prioridad cuando hay repo mixto (ej. PHP con Playwright en Node): PHP es backend principal si composer.json existe
  let primaryStack: StackKind = 'unknown';
  if (hasComposerJson && !hasTsConfig && !('vitest' in allNodeDeps) && !('jest' in allNodeDeps)) {
    primaryStack = 'php';
  } else if (hasPackageJson) {
    primaryStack = 'node';
  } else if (hasComposerJson) {
    primaryStack = 'php';
  } else if (hasPythonProject) {
    primaryStack = 'python';
  }

  const base: RepoStack = {
    repoPath: resolvedPath,
    repoName: path.basename(resolvedPath),
    primaryStack,
    detectedStacks: detectedStacks.length > 0 ? detectedStacks : ['unknown'],
    hasTypeScript,
    hasPackageJson,
    hasComposerJson,
    hasPythonProject,
    hasPlaywright,
    hasAccessibilityTooling,
    packageScripts,
    composerScripts
  };

  if (gitBranch) {
    return { ...base, gitBranch };
  }
  return base;
}
