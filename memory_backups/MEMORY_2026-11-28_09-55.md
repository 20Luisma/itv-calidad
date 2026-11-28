# MEMORY.md — ITV de Código

## Contexto General
- **Proyecto:** ITV de Código — MCP App & Auditor Local (`itv-calidad`, repo GitHub: `https://github.com/20Luisma/itv-calidad`).
- **Objetivo:** Herramienta **100% local y de solo lectura** (**Extensión de Barra Lateral VS Code / Open VSX + MCP App interactiva embebida + Servidor MCP Stdio + Dashboard Web SSE + CLI / Hook `pre-push`**) que inspecciona cualquier repositorio local **antes de hacer `git push`** pasando por **7 estaciones reales de calidad, seguridad y observabilidad**, explicando qué audita cada estación, por qué importa y cómo corregir los fallos.
- **Origen:** Surge tras auditar y pulir el proyecto `20Luisma/marvel` y detectar el valor de tener un auditor determinista y visual en local para flujos con agentes de IA, sin cajas negras ni cuentas obligatorias.
- **Restricciones clave:** 0 cuentas obligatorias (integraciones SonarCloud/Sentry/GitHub opcionales vía `.env` local `chmod 600`), 0 tokens pagos, solo lectura sobre el repo inspeccionado, cero falsos verdes, 0 CVEs propios, sin la palabra "Didáctica" en UI/CLI/docs.

## Arquitectura Técnica
- **Stack:** Node.js (LTS) + TypeScript (`strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`) + `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps` + `esbuild` + Vitest 5 (`@vitest/coverage-v8`) + Playwright E2E + servidor HTTP/SSE nativo (`node:http`) + UI Web modular (`public/`) con CSP estricta sin inline scripts ni inline styles.
- **Capas:**
  - `src/domain/`: `types.ts`, `catalog.ts`, `report.ts` (puro, sin Node/HTTP).
  - `src/application/`: `DetectRepoStack.ts` (PHP/Node/Python + mixtos + vanilla sin manifiesto), `RunItvInspection.ts` (cámara lenta + eventos + AbortSignal), `ExportReportMarkdown.ts`.
  - `src/infrastructure/`: `SafeCommandExecutor.ts` (`spawn` con `shell: false`, timeouts, `AbortSignal`, `stripAnsi`), `NativeFolderPicker.ts` (macOS Finder, Windows PowerShell, Linux zenity/kdialog), `RepoFileWalker.ts`, `config/loadDotEnv.ts` (`.env` `chmod 600` sin exponer tokens), `integrations/` (`SonarCloudClient.ts`, `SentryApiClient.ts`, `GitHubSecurityClient.ts`), `scanners/` (`SecretAndIpScanner.ts`, `SecurityChecklistScanner.ts`, `StaticHtmlA11yScanner.ts`, `CodeHealthSonarScanner.ts`, `ObservabilitySentryScanner.ts`) y `stations/` (7 estaciones + `stationHelpers.ts`).
  - `src/interfaces/`:
    - CLI (`cli/parseArgs.ts`, `cli/index.ts`)
    - Web/SSE (`web/httpApp.ts`, `web/server.ts`) + Dashboard `public/`
    - **MCP Server + MCP App (`mcp/server.ts`, `mcp/handlers.ts`, `mcp/ui/{template.html,styles.css,render.ts,app-client.ts}`):** versión `1.3.0`, recurso `ui://itv-calidad/app.html` compilado por `scripts/build-mcp-app.mjs` a `dist/interfaces/mcp/app.html` (`npm run build`), 3 herramientas (`run_itv`, `get_security_checklist`, `list_itv_stations`) con `annotations` oficiales MCP (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), entrypoints `aux_pane` y `global` en Antigravity, registrado en `/Users/admin/.gemini/antigravity/mcp_config.json`.
    - **Extensión de Barra Lateral VS Code / Open VSX (`extensions/vscode-itv/`):** paquete `20luisma.itv-calidad-vscode` v1.3.0 empaquetado con `esbuild` + `zip -qrX` (`scripts/build-vscode-extension.mjs`, `<GalleryFlags>Public</GalleryFlags>`), árbol interactivo de 7 estaciones, cabina Webview con CSP `nonce`, KPI `InspectionScope` y panel **⚙ Integraciones** cifrado con `SecretStorage`.
  - **Hook portable `pre-push` (`.githooks/pre-push`):** ejecuta auto-ITV local (`--fast`) antes de cada push sin consumir tokens de IA (`git config core.hooksPath .githooks`).
- **CI / GitHub Actions:** `.github/workflows/ci.yml` en `ubuntu-24.04` (con `workflow_dispatch` y `paths-ignore` para docs, instala `@rolldown/binding-linux-x64-gnu` con `--no-save` para evitar npm bug #4828 sin contaminar `package.json`), pasando `typecheck`, `test:coverage`, `e2e`, `audit:deps` y auto-ITV en verde.
- **ADRs:**
  - `docs/adr/ADR-001-arquitectura-itv-didactica.md`
  - `docs/adr/ADR-002-checklist-diligencia-debida-seguridad.md`
  - `docs/adr/ADR-003-estacion-7-sonar-observabilidad.md`

## Estado Actual y Próximos Pasos
- **Estado actual (v1.6.0 lista en `main` `dd6da9a` — 4/4 Issues del roadmap cerrados vía PRs `#5`–`#8` con CI en verde):**
  - Auto-ITV propia en **7/7 APTO** (`0 observaciones · 0 desfavorables · 0 omitidas`): `tsc --noEmit` 0 errores (motor + extensión), **48/48 tests (11 archivos) · 85.43% stmts / 86.74% lines** Vitest (>75% gate), **0 CVEs**, **Checklist 6/6 (100%)**, **Playwright E2E 3/3** y **0 duplicados DRY**.
  - **6 stacks nativos:** **Node/TS · PHP · Python · .NET/C# · Go · Flutter/Dart** (probado en vivo contra SDK oficial `.NET 8` en Docker y contra `app_flutter` real en Mac).
  - **Novedades `v1.6.0` (4 PRs mergeados):**
    - PR `#5` (`Closes #1`): salida nativa `EN / ES` (`src/domain/i18n.ts`, `--lang es|en` en CLI, Markdown y MCP `run_itv`).
    - PR `#6` (`Closes #2`): GitHub Action oficial (`action.yml`) con `$GITHUB_STEP_SUMMARY`, comentario sticky sin spam en PRs y gate estricto sin falsos verdes.
    - PR `#7` (`Closes #3`): soporte nativo **Flutter/Dart** (`pubspec.yaml`, `dart analyze`, `flutter test`/`dart test`, `.dart`) y **Go** (`go.mod`, `go vet`, `go test -cover`, `govulncheck`, `.go`).
    - PR `#8` (`Closes #4`): workflow automático `.github/workflows/release.yml` disparado por tags `v*.*.*` (gates + build `.vsix` + GitHub Release automático + hooks opcionales para `npm` y Open VSX).
  - **Distribución y credibilidad:** `npm` (`itv-calidad`, 1.5.1 live, listo para publicar `1.6.0`), **VS Code Marketplace** + **Open VSX** (`dist/itv-calidad-vscode-1.6.0.vsix` compilado), **M8ven Trust Index B · Emerging**, GitHub Release `v1.5.1` publicado, perfil `20Luisma` con 6 tiendas/registros oficiales y regla de flujo `Issue → rama → PR → CI verde → Merge` añadida en `~/.gemini/GEMINI.md`.
- **Próximos pasos:**
  - Crear tag `v1.6.0` (con aprobación explícita de Martín) para disparar automáticamente el GitHub Release `v1.6.0` con el `.vsix`.
  - Publicar `v1.6.0` en `npm` (`npm publish --access public`) y subir `dist/itv-calidad-vscode-1.6.0.vsix` a VS Code Marketplace y Open VSX.
  - Difusión: PR a `punkpeye/awesome-mcp-servers`, alta en `smithery.ai` / `glama.ai` / `mcp.so`, envío a `console.dev` y post en **Show HN** / LinkedIn.

## Historial de Sesiones
- **2026-11-23 (Sesión 1):** Bootstrap inicial del proyecto (`AGENTS.md`, `MEMORY.md`, `ADR-001`, `.agents/`).
- **2026-11-23 (Sesión 2):** Implementación de 7 estaciones, Checklist OWASP/RGPD (`ADR-002`), Estación 7 Sonar/Sentry/GitHub (`ADR-003`), Dashboard dark mode WCAG 2.1 AA, Playwright E2E, selector de carpetas multiplataforma y publicación en GitHub.
- **2026-11-23 / 2026-11-24 (Sesión 3):** Servidor MCP Stdio + **MCP App interactiva embebida** (`ui://itv-calidad/app.html`), CI GitHub Actions en verde, README bilingüe (`README.md` español neutro + `README.en.md` inglés) con GIFs de Extensión y MCP App, About + 17 topics en GitHub, **Extensión VS Code Marketplace publicada (`20luisma.itv-calidad-vscode` v1.3.0)** con panel **⚙ Integraciones** (`SecretStorage`), **`InspectionScope`** (`full` / `partial` / `diagnostic-only`) + 3 tests nuevos (**84.9% cobertura · 7/7 APTO · 0 CVEs**), `AGENTS.md` sincronizado y **`SECURITY.md`** bilingüe.
- **2026-11-27 (Sesión 4):** Publicación en **Open VSX Registry** (`v1.3.0`, fix `zip -qrX` y verificación namespace `20luisma`), activación de hook portable `.githooks/pre-push` (`605d6a1`), cumplimiento especificación MCP + **M8ven Trust Index** (`annotations` booleanas en las 3 herramientas en `src/interfaces/mcp/server.ts`, tests de contrato en `tests/mcp-handlers.test.ts`, timeout SSE 20s en `tests/http-server.test.ts` → **39/39 tests · 84.54% cobertura**), claim + badge verificado M8ven (`9f653ea`), perfil GitHub `20Luisma` actualizado y publicación en vivo en el **Discord oficial de Model Context Protocol** (`#showcase`).
