# MEMORY.md — ITV de Código

## Contexto General
- **Proyecto:** ITV de Código (`itv-calidad`, repo GitHub: `https://github.com/20Luisma/itv-calidad`).
- **Objetivo:** Herramienta **100% local** (CLI + Dashboard Web en cámara lenta) que inspecciona cualquier repositorio local **antes de hacer `git push`** pasando por **6 estaciones de calidad** con estándar profesional completo, explicando qué audita cada estación, por qué importa y cómo corregir los fallos.
- **Origen:** Surge tras auditar y pulir el proyecto `20Luisma/marvel` (657+80 tests, PHPStan 7, `composer audit` 0 CVEs, Playwright E2E, Pa11y/Lighthouse, SonarCloud) y detectar el valor de ver y entender cada capa de calidad de forma visual, concreta y 100% local sin cuentas ni tokens.
- **Restricciones clave:** 0 cuentas externas, 0 tokens pagos, solo lectura sobre el repo inspeccionado, cero falsos verdes, 0 CVEs propios.

## Arquitectura Técnica
- **Stack:** Node.js (LTS) + TypeScript (`strict: true`, `exactOptionalPropertyTypes: true`) + Vitest 5 (`@vitest/coverage-v8`) + servidor HTTP/SSE nativo (`node:http`) + UI Web modular (`public/index.html`, `public/css/tokens.css`, `public/css/styles.css`, `public/js/renderers.js`, `public/js/app.js`) con CSP estricta sin inline scripts ni inline styles.
- **Capas:**
  - `src/domain/`: `types.ts`, `catalog.ts`, `report.ts` (puro, sin Node/HTTP).
  - `src/application/`: `DetectRepoStack.ts` (PHP/Node/Python + mixtos), `RunItvInspection.ts` (cámara lenta + eventos + AbortSignal), `ExportReportMarkdown.ts`.
  - `src/infrastructure/`: `SafeCommandExecutor.ts` (`spawn` con `shell: false`, timeouts y `AbortSignal`), `RepoFileWalker.ts` (solo lectura), `SecretAndIpScanner.ts`, `SecurityChecklistScanner.ts`, `StaticHtmlA11yScanner.ts` y las 6 estaciones en `src/infrastructure/stations/`.
  - `src/interfaces/`: CLI (`cli/parseArgs.ts`, `cli/index.ts`) y Web/SSE (`web/httpApp.ts`, `web/server.ts`) con endpoint `POST /api/pick-folder` (Finder nativo macOS vía `osascript`) y `POST /api/export/markdown`.
- **Las 6 Estaciones:**
  1. Sintaxis y configuración (`JSON.parse`, `npm run lint`/`node --check`, `composer validate --strict`, `php -l`, `py_compile`)
  2. Análisis estático de tipos (`tsc --noEmit`, `vendor/bin/phpstan`, `mypy`/`ruff`)
  3. Tests automáticos + cobertura (*coverage gate* configurable, default `75%`)
  4. Seguridad, CVEs y **Checklist de Tranquilidad / Diligencia Debida (OWASP ASVS Nivel 1 + RGPD Art. 32)** (`npm audit`, `composer audit`, `pip-audit`, escáner de secretos/IPs/`eval`/`shell: true`, cabeceras HTTP + bloque operativo/contractual con aviso legal)
  5. Pruebas E2E en navegador (Playwright: `test:e2e`, `e2e`, `playwright test`)
  6. Accesibilidad y calidad UI (`test:a11y`, `pa11y --standard WCAG2AA <url>` con autodetección de Chrome en macOS + diferenciación de fallo de entorno vs violación WCAG + escáner estático de vistas `.html`/`.htm`/`.php`/`.jsx`/`.tsx`/`.vue`)
- **ADRs:**
  - `docs/adr/ADR-001-arquitectura-itv-didactica.md`
  - `docs/adr/ADR-002-checklist-diligencia-debida-seguridad.md`

## Estado Actual y Próximos Pasos
- **Estado actual (v1.0 estable publicada en GitHub `main`):**
  - Implementación completa, verificada con su propia ITV (**APTO**, `tsc --noEmit` 0 errores, **23 tests en verde**, **83.09% cobertura** > 75%, **0 CVEs**, **Checklist 100%**).
  - Probada en combate sobre repos reales (`tinder_copilot` llevado de DESFAVORABLE 17% a APTO 6/6 100%, y `20Luisma/marvel` mixto PHP+Node).
  - Dashboard rediseñado estilo cabina técnica dark mode con semáforo LED, íconos SVG por estación, KPIs, botón **Examinar…** (macOS) y exportación `.md`/`.json`.
  - Tag estable `v-estable-2026-11-23` creado y sincronizado con `origin`.
- **Posibles mejoras futuras (opcionales):**
  - Soporte selector nativo de carpetas en Windows/Linux (fallback PowerShell / zenity).
  - Limpiar códigos ANSI en la vista previa de `rawOutput` del Dashboard (ej. salidas de Playwright).
  - Modo hook `pre-push` instalable con un comando (`npx itv-codigo install-hook`).

## Historial de Sesiones
- **2026-11-23 (Sesión 1):** Bootstrap inicial completo del proyecto (`AGENTS.md`, `MEMORY.md`, `ADR-001`, workflows `.agents/` y primer commit).
- **2026-11-23 (Sesión 2):** Implementación completa de **ITV de Código (`itv-calidad`)**: motor TS strict + 6 estaciones + Checklist de Tranquilidad OWASP/RGPD (`ADR-002`) + CLI + servidor SSE + Dashboard dark mode cabina técnica + selector Finder macOS + auditoría WCAG en vivo con autodetección de Chrome + publicación en `https://github.com/20Luisma/itv-calidad` y tag `v-estable-2026-11-23`.
