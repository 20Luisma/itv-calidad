import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const uiDir = path.join(rootDir, 'src', 'interfaces', 'mcp', 'ui');
const outDir = path.join(rootDir, 'dist', 'interfaces', 'mcp');

async function buildMcpApp() {
  const bundled = await esbuild.build({
    entryPoints: [path.join(uiDir, 'app-client.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2022'],
    write: false
  });

  const jsCode = bundled.outputFiles[0]?.text ?? '';
  const [cssCode, templateHtml] = await Promise.all([
    readFile(path.join(uiDir, 'styles.css'), 'utf8'),
    readFile(path.join(uiDir, 'template.html'), 'utf8')
  ]);

  const finalHtml = templateHtml
    .replace('/*__INLINE_CSS__*/', () => cssCode)
    .replace('/*__INLINE_JS__*/', () => jsCode);

  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'app.html');
  await writeFile(outPath, finalHtml, 'utf8');
  console.log(`✅ MCP App bundle generado: ${outPath} (${(finalHtml.length / 1024).toFixed(1)} KB)`);
}

await buildMcpApp();
