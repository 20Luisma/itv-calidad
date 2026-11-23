# MEMORY.md — ITV Didáctica de Código

## Contexto General
- **Proyecto:** ITV Didáctica de Código (`itv-didactica-codigo`).
- **Objetivo:** Herramienta **100% local** (CLI + Dashboard Web en cámara lenta) que inspecciona cualquier repositorio local **antes de hacer `git push`** pasando por **6 estaciones didácticas** con estándar profesional completo, explicando qué audita cada estación, por qué importa y cómo corregir los fallos.
- **Origen:** Surge tras auditar y pulir el proyecto `20Luisma/marvel` (657+80 tests, PHPStan 7, `composer audit` 0 CVEs, Playwright E2E, Pa11y/Lighthouse, SonarCloud) y detectar el valor de ver y entender cada capa de calidad de forma visual, concreta y 100% local sin cuentas ni tokens.
- **Restricciones clave:** 0 cuentas externas, 0 tokens pagos, solo lectura sobre el repo inspeccionado, cero falsos verdes.

## Arquitectura Técnica
- **Stack:** Node.js (LTS) + TypeScript (`strict: true`) + UI Web modular (`public/index.html`, `public/css/`, `public/js/`) conectada vía SSE (Server-Sent Events) para animación en cámara lenta.
- **Capas:** `src/domain` (contratos y entidades), `src/application` (orquestador de las 6 estaciones y detector de stack), `src/infrastructure` (runners por estación + escáner de secretos/IPs), `src/interfaces/cli` + `src/interfaces/web`.
- **Las 6 Estaciones:**
  1. Sintaxis y configuración (`php -l` / `composer validate` / `eslint` / `py_compile`)
  2. Análisis estático de tipos (`phpstan` / `tsc --noEmit` / `ruff` / `mypy`)
  3. Tests automáticos + cobertura (*coverage gate*)
  4. Seguridad y dependencias (`composer audit` / `npm audit` + escaneo de secretos e IPs `http://` hardcodeadas)
  5. Pruebas E2E en navegador (Playwright)
  6. Accesibilidad y calidad UI (`@axe-core/playwright` / Pa11y / Lighthouse)
- **ADRs:** `docs/adr/ADR-001-arquitectura-itv-didactica.md`.

## Estado Actual y Próximos Pasos
- **Estado actual:** Bootstrap inicial completado (`AGENTS.md`, `MEMORY.md`, `.env.example`, `.gitignore`, `README.md`, `docs/adr/ADR-001`, `.agents/` y primer commit). **Aún no se escribió código de aplicación (`package.json` ni `src/`).**
- **Próximos pasos (al abrir este workspace en Antigravity):**
  1. Inicializar `package.json`, `tsconfig.json` (strict) y Vitest.
  2. Implementar `src/domain/` (contratos de estación, reporte y hallazgos) + `DetectRepoStack` (PHP / Node / Python).
  3. Implementar las 6 estaciones en `src/infrastructure/stations/` + pruebas unitarias aisladas.
  4. Implementar CLI con modo cámara lenta + Dashboard Web local con SSE (`public/`).
  5. Probar la ITV completa en local contra el propio repo y contra un repo PHP/Node real, pasar `tsc --noEmit` + Vitest + `npm audit` y sugerir `/tag`.

## Historial de Sesiones
- **2026-11-23:** Bootstrap inicial completo del proyecto en `/Users/admin/Desktop/Proyectos/itv-didactica-codigo` (estructura base, `AGENTS.md`, `MEMORY.md`, `ADR-001`, workflows `.agents/` y primer commit).
