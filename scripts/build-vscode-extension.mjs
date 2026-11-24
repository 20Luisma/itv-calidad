import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const extDir = path.join(rootDir, 'extensions', 'vscode-itv');
const extDistDir = path.join(extDir, 'dist');
const bundlePath = path.join(extDistDir, 'extension.js');

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".map" ContentType="application/json"/>
  <Default Extension=".svg" ContentType="image/svg+xml"/>
  <Default Extension=".png" ContentType="image/png"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
`;
}

function buildVsixManifest(pkg) {
  const tags = (pkg.keywords || []).join(',');
  const categories = (pkg.categories || []).join(',');
  return `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="es-ES" Id="${pkg.name}" Version="${pkg.version}" Publisher="${pkg.publisher}" />
    <DisplayName>${pkg.displayName}</DisplayName>
    <Description xml:space="preserve">${pkg.description}</Description>
    <Tags>${tags}</Tags>
    <Categories>${categories}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Icon>extension/media/icon.png</Icon>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${pkg.engines.vscode}" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/media/icon.png" Addressable="true" />
  </Assets>
</PackageManifest>
`;
}

async function main() {
  mkdirSync(extDistDir, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(extDir, 'src', 'extension.ts')],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['vscode'],
    sourcemap: true
  });

  const pkg = JSON.parse(readFileSync(path.join(extDir, 'package.json'), 'utf8'));
  const stageDir = path.join(extDir, '.vsix-stage');
  rmSync(stageDir, { recursive: true, force: true });

  const extStage = path.join(stageDir, 'extension');
  mkdirSync(path.join(extStage, 'dist'), { recursive: true });
  mkdirSync(path.join(extStage, 'media'), { recursive: true });

  copyFileSync(path.join(extDir, 'package.json'), path.join(extStage, 'package.json'));
  copyFileSync(bundlePath, path.join(extStage, 'dist', 'extension.js'));
  cpSync(path.join(extDir, 'media'), path.join(extStage, 'media'), { recursive: true });
  const readmeRaw = readFileSync(path.join(rootDir, 'README.md'), 'utf8').replace(
    '(docs/assets/itv-mcp-demo.gif)',
    '(https://raw.githubusercontent.com/20Luisma/itv-calidad/main/docs/assets/itv-mcp-demo.gif)'
  );
  writeFileSync(path.join(extStage, 'README.md'), readmeRaw, 'utf8');

  writeFileSync(path.join(stageDir, '[Content_Types].xml'), buildContentTypesXml(), 'utf8');
  writeFileSync(path.join(stageDir, 'extension.vsixmanifest'), buildVsixManifest(pkg), 'utf8');

  const outDir = path.join(rootDir, 'dist');
  mkdirSync(outDir, { recursive: true });
  const vsixPath = path.join(outDir, `${pkg.name}-${pkg.version}.vsix`);
  rmSync(vsixPath, { force: true });

  execFileSync('zip', ['-qr', vsixPath, '[Content_Types].xml', 'extension.vsixmanifest', 'extension'], {
    cwd: stageDir,
    stdio: 'inherit'
  });

  rmSync(stageDir, { recursive: true, force: true });

  const sizeKb = (statSync(vsixPath).size / 1024).toFixed(1);
  console.log(`VS Code / Open VSX extension built: ${vsixPath} (${sizeKb} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
