# MEMORY.md — ITV de Código

## Contexto General
- **Proyecto:** ITV de Código (`itv-calidad`, repo GitHub: `https://github.com/20Luisma/itv-calidad`).
- **Objetivo:** Herramienta **100% local** (CLI + Dashboard Web en cámara lenta) que inspecciona cualquier repositorio local **antes de hacer `git push`** pasando por **7 estaciones de calidad, seguridad y observabilidad**, explicando qué audita cada estación, por qué importa y cómo corregir los fallos.
- **Origen:** Surge tras auditar y pulir el proyecto `20Luisma/marvel` (657+80 tests, PHPStan 7, `composer audit` 0 CVEs, Playwright E2E, Pa11y/Lighthouse, SonarCloud) y detectar el valor de ver y entender cada capa de calidad de forma visual, concreta y 100% local sin cuentas obligatorias.
- **Restricciones clave:** 0 cuentas obligatorias (integraciones SonarCloud/Sentry/GitHub opcionales vía `.env` local `chmod 600`), 0 tokens pagos, solo lectura sobre el repo inspeccionado, cero falsos verdes, 0 CVEs propios.

## Arquitectura Técnica
- **Stack:** Node.js (LTS) + TypeScript (`strict: true`, `exactOptionalPropertyTypes: true`) + Vitest 5 (`@vitest/coverage-v8`) + Playwright E2E + servidor HTTP/SSE nativo (`node:http`) + UI Web modular (`public/index.html`, `public/css/tokens.css`, `public/css/styles.css`, `public/js/renderers.js`, `public/js/app.js`, `public/favicon.svg`) con CSP estricta sin inline scripts ni inline styles.
- **Capas:**
  - `src/domain/`: `types.ts`, `catalog.ts`, `report.ts` (puro, sin Node/HTTP).
  - `src/application/`: `DetectRepoStack.ts` (PHP/Node/Python + mixtos), `RunItvInspection.ts` (cámara lenta + eventos + AbortSignal), `ExportReportMarkdown.ts`.
  - `src/infrastructure/`: `SafeCommandExecutor.ts` (`spawn` con `shell: false`, timeouts y `AbortSignal`), `RepoFileWalker.ts`, `config/loadDotEnv.ts` (persistencia segura `.env` `chmod 600` sin exponer tokens al cliente), `integrations/` (`SonarCloudClient.ts`, `SentryApiClient.ts`, `GitHubSecurityClient.ts`), `scanners/` (`SecretAndIpScanner.ts`, `SecurityChecklistScanner.ts`, `StaticHtmlA11yScanner.ts`, `CodeHealthSonarScanner.ts`, `ObservabilitySentryScanner.ts`) y `stations/` (7 estaciones + `stationHelpers.ts`).
  - `src/interfaces/`: CLI (`cli/parseArgs.ts`, `cli/index.ts`) y Web/SSE (`web/httpApp.ts`, `web/server.ts`) con endpoints `POST /api/pick-folder`, `GET/POST /api/integrations` y `POST /api/export/markdown`.
- **Las 7 Estaciones:**
  1. Sintaxis y configuración
  2. Análisis estático de tipos (`tsc --noEmit`, PHPStan, `mypy`/`ruff`)
  3. Tests automáticos + cobertura (*coverage gate* default `75%`)
  4. Seguridad, CVEs y **Checklist de Tranquilidad / Diligencia Debida (OWASP ASVS Nivel 1 + RGPD Art. 32)**
  5. Pruebas E2E en navegador (Playwright — propia suite `e2e/dashboard.spec.ts` incluida)
  6. Accesibilidad y calidad UI (`test:a11y`, `pa11y --standard WCAG2AA <url>` con autodetección de Chrome en macOS + diferenciación fallo de entorno vs WCAG + escáner estático de vistas `.html`/`.htm`/`.php`/`.jsx`/`.tsx`/`.vue`)
  7. Deuda Técnica y Observabilidad (análisis local de archivos monolíticos, complejidad, duplicados DRY, `debugger`/`var_dump`, auditoría estática Sentry/logs + **integración opcional en vivo con SonarCloud, Sentry y GitHub Security** desde el modal **⚙ Integraciones** con etiqueta dinámica en la pista).
- **ADRs:**
  - `docs/adr/ADR-001-arquitectura-itv-didactica.md`
  - `docs/adr/ADR-002-checklist-diligencia-debida-seguridad.md`
  - `docs/adr/ADR-003-estacion-7-sonar-observabilidad.md`

## Estado Actual y Próximos Pasos
- **Estado actual (v1.1 completa en GitHub `main`):**
  - Auto-ITV propia en **7/7 APTO** (`0 observaciones · 0 desfavorables · 0 omitidas`): `tsc --noEmit` 0 errores, **84.28% cobertura** Vitest, **0 CVEs**, **Checklist 100%**, **Playwright E2E 3/3**, **Pa11y WCAG 2.1 AA 0 errores** y **0 duplicados DRY**.
  - Probada en vivo contra `tinder_copilot`, `20Luisma/marvel` y el propio repo con Sentry + GitHub Security + SonarCloud.
- **Posibles mejoras futuras (opcionales):**
  - Selector nativo de carpetas para Windows/Linux (fallback PowerShell / zenity).
  - Limpiar códigos ANSI en la vista previa de `rawOutput` del Dashboard.
  - Instalador de hook `pre-push` en 1 comando.

## Historial de Sesiones
- **2026-11-23 (Sesión 1):** Bootstrap inicial del proyecto (`AGENTS.md`, `MEMORY.md`, `ADR-001`, `.agents/`).
- **2026-11-23 (Sesión 2):** Implementación completa de **ITV de Código (`itv-calidad`)** con 7 estaciones, Checklist de Diligencia Debida OWASP/RGPD (`ADR-002`), Estación 7 Deuda Técnica + Observabilidad (`ADR-003`), Modal **⚙ Integraciones** (SonarCloud, Sentry, GitHub Security con `.env` `chmod 600` y etiqueta dinámica), rediseño cabina técnica dark mode + selector Finder macOS + contraste WCAG 2.1 AA validado con `pa11y` + suite Playwright E2E propia (`7/7 APTO`), publicado en `https://github.com/20Luisma/itv-calidad`.
