# MEMORY.md — ITV de Código

## Contexto General
- **Proyecto:** ITV de Código — MCP App & Auditor Local (`itv-calidad`, repo GitHub: `https://github.com/20Luisma/itv-calidad`).
- **Objetivo:** Herramienta **100% local y de solo lectura** (**MCP App interactiva embebida + Servidor MCP Stdio + Dashboard Web SSE + CLI**) que inspecciona cualquier repositorio local **antes de hacer `git push`** pasando por **7 estaciones reales de calidad, seguridad y observabilidad**, explicando qué audita cada estación, por qué importa y cómo corregir los fallos.
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
    - **MCP Server + MCP App (`mcp/server.ts`, `mcp/handlers.ts`, `mcp/ui/{template.html,styles.css,render.ts,app-client.ts}`):** recurso `ui://itv-calidad/app.html` compilado por `scripts/build-mcp-app.mjs` a `dist/interfaces/mcp/app.html` (`npm run build`), 3 herramientas (`run_itv`, `get_security_checklist`, `list_itv_stations`), entrypoints `aux_pane` y `global` en Antigravity, registrado en `/Users/admin/.gemini/antigravity/mcp_config.json`.
- **CI / GitHub Actions:** `.github/workflows/ci.yml` en `ubuntu-24.04` (instala `@rolldown/binding-linux-x64-gnu` con `--no-save` para evitar npm bug #4828 sin contaminar `package.json`), pasando `typecheck`, `test:coverage`, `e2e`, `audit:deps` y auto-ITV en verde.
- **ADRs:**
  - `docs/adr/ADR-001-arquitectura-itv-didactica.md`
  - `docs/adr/ADR-002-checklist-diligencia-debida-seguridad.md`
  - `docs/adr/ADR-003-estacion-7-sonar-observabilidad.md`

## Estado Actual y Próximos Pasos
- **Estado actual (v1.2 — MCP App + CI en verde en `main`):**
  - Auto-ITV propia (CLI y MCP `run_itv`) en **7/7 APTO** (`0 observaciones · 0 desfavorables · 0 omitidas`): `tsc --noEmit` 0 errores, **35/35 tests · 84.54% cobertura** Vitest (>75% gate), **0 CVEs**, **Checklist 6/6 (100%)**, **Playwright E2E 3/3**, **Pa11y WCAG 2.1 AA 0 errores** y **0 duplicados DRY**.
  - **MCP App** operativa en vivo dentro de Antigravity (chat + pestaña `ITV de Código` en panel lateral) con animación de escaneo, semáforo LED, re-escaneo en 1 clic (`Pasar ITV`) y botón para pedir al agente corregir hallazgos.
  - **README.md y GitHub** actualizados con título MCP App, GIF demo en `docs/assets/itv-mcp-demo.gif`, regla lista para `GEMINI.md`/`AGENTS.md`, descripción About profesional y 16 topics de descubrimiento.
- **Próximos pasos opcionales:**
  - Publicar paquete en **npm** (`npx -y itv-calidad-mcp`) para instalación en 1 línea sin `git clone`.
  - Versión bilingüe del README (`README.md` EN + `README.es.md`) y registro en directorios MCP (`awesome-mcp-servers`, `smithery.ai`, `mcp.so`, `glama.ai`).
  - Crear nuevo tag estable (con aprobación explícita de Martín) para sellar v1.2 MCP App.

## Historial de Sesiones
- **2026-11-23 (Sesión 1):** Bootstrap inicial del proyecto (`AGENTS.md`, `MEMORY.md`, `ADR-001`, `.agents/`).
- **2026-11-23 (Sesión 2):** Implementación de 7 estaciones, Checklist OWASP/RGPD (`ADR-002`), Estación 7 Sonar/Sentry/GitHub (`ADR-003`), Dashboard dark mode WCAG 2.1 AA, Playwright E2E, selector de carpetas multiplataforma y publicación en GitHub.
- **2026-11-23 / 2026-11-24 (Sesión 3):** Servidor MCP Stdio + **MCP App interactiva embebida** (`ui://itv-calidad/app.html` con `@modelcontextprotocol/ext-apps` + `esbuild`), verificación en vivo 7/7 APTO en Antigravity, CI GitHub Actions en verde, README actualizado con GIF demo (`docs/assets/itv-mcp-demo.gif`) y orden para `GEMINI.md`, About + 16 topics en GitHub, y **Extensión de barra lateral VS Code / Open VSX (`20luisma.itv-calidad-vscode` v1.2.1)** con cabina Webview, árbol de 7 estaciones con salto a archivo/línea, panel **⚙ Integraciones** sobre `SecretStorage` cifrado, icono PNG 256×256 y publicación en **Visual Studio Marketplace** (`https://marketplace.visualstudio.com/items?itemName=20luisma.itv-calidad-vscode`).
