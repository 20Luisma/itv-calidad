# AGENTS.md — ITV de Código (`itv-calidad`)

> Protocolo técnico oficial del proyecto. Léelo junto con `MEMORY.md` antes de modificar código.

## 1. Propósito del Proyecto
**ITV de Código (`itv-calidad`)** es una herramienta **100% local, open-source y de solo lectura (0 cuentas obligatorias, 0 tokens pagos)** que se ejecuta **antes de hacer `git push`** sobre cualquier repositorio local (**PHP, Node.js/TypeScript o Python**, incluidos repos mixtos o sin manifiesto) pasando por **7 estaciones reales de calidad, seguridad y observabilidad**, explicando con claridad **qué audita cada estación, qué comando ejecuta, por qué importa y cómo corregir cada fallo**.

## 2. Stack Tecnológico
- **Motor principal:** Node.js (`>= 20` LTS) + TypeScript (`strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `tsc --noEmit`).
- **4 Interfaces sobre el mismo núcleo (Clean Architecture):**
  1. **Extensión de Barra Lateral VS Code / Open VSX (`extensions/vscode-itv/`):** empaquetada con `esbuild` en `.vsix`, con icono en Activity Bar, cabina Webview con CSP `nonce`, árbol interactivo de 7 estaciones con salto a archivo/línea y panel **⚙ Integraciones** cifrado con `SecretStorage`.
  2. **Servidor MCP Stdio + MCP App embebida (`src/interfaces/mcp/`):** `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps` (`ui://itv-calidad/app.html` compilada por `scripts/build-mcp-app.mjs`).
  3. **Dashboard Web Local SSE (`src/interfaces/web/` + `public/`):** servidor HTTP nativo (`node:http`) + Server-Sent Events en cámara lenta + HTML5 semántico, CSS modular externo con Design Tokens y JS ES Modules externo (CSP estricta sin `<style>` ni `<script>` inline con lógica).
  4. **CLI (`src/interfaces/cli/`):** pensado para terminal local y hooks `pre-push`, con exportación `--markdown` y `--json`.
- **Testing y Calidad propia del repo:** Vitest 5 (`@vitest/coverage-v8`, gate `>= 75%`) + Playwright E2E + `tsc --noEmit` + `npm audit` (0 CVEs) + GitHub Actions CI (`.github/workflows/ci.yml`).

## 3. Las 7 Estaciones de la ITV (Orden Obligatorio)
1. **Estación 1 — Sintaxis y Configuración:** valida que el código parsee y los manifiestos estén íntegros (`JSON.parse`, `npm run lint` / `node --check`, `composer validate --strict`, `php -l`, `python3 -m py_compile`).
2. **Estación 2 — Análisis Estático de Tipos:** detecta bugs de contratos y tipos antes de ejecutar (`tsc --noEmit`, `vendor/bin/phpstan analyse`, `mypy` / `ruff`).
3. **Estación 3 — Tests Automáticos y Cobertura:** ejecuta la suite local aislada (`vitest`/`jest`, `phpunit`, `pytest`) y valida el umbral mínimo de cobertura (*coverage gate*, default `75%`).
4. **Estación 4 — Seguridad, CVEs y Diligencia Debida:** audita dependencias (`npm audit`, `composer audit`, `pip-audit`), escanea secretos/tokens, IPs `http://` y patrones críticos (`eval()`, `shell: true`), y genera el **Checklist OWASP ASVS Nivel 1 / RGPD Art. 32**.
5. **Estación 5 — Pruebas E2E en Navegador:** ejecuta suites E2E (Playwright) si el repositorio objetivo las define.
6. **Estación 6 — Accesibilidad y Calidad UI:** valida accesibilidad WCAG 2.1 AA (`test:a11y`, `pa11y --standard WCAG2AA <url>` con autodetección de navegador local + escáner estático de vistas `.html/.htm/.php/.jsx/.tsx/.vue`).
7. **Estación 7 — Deuda Técnica y Observabilidad (Sonar / Sentry / GitHub):** análisis local (archivos `>500` líneas, complejidad ciclomática `>85`, duplicados DRY, `debugger`/`var_dump`, fugas de observabilidad/PII) + integración opcional en vivo con **SonarCloud, Sentry y GitHub Security** vía `.env` o `SecretStorage`.

Cada estación devuelve un contrato uniforme (`id`, `name`, `shortName`, `didacticExplanation`, `command`, `status` [`pass` | `warn` | `fail` | `skipped`], `durationMs`, `summary`, `findings[]`, `externalLinks?`).
- **Regla de Oro de Diagnóstico:** nunca devolver falso verde ante un fallo real; si una herramienta no aplica al stack objetivo, devolver `skipped` con explicación clara.

## 4. Arquitectura (Clean Architecture Ligera)
- `src/domain/`: tipos puros (`types.ts`), catálogo de 7 estaciones (`catalog.ts`) y cálculo de veredictos (`report.ts`). Sin dependencias de Node/HTTP.
- `src/application/`: casos de uso (`DetectRepoStack`, `RunItvInspection` con cámara lenta, eventos y `AbortSignal`, `ExportReportMarkdown`).
- `src/infrastructure/`: `SafeCommandExecutor` (`spawn` con `shell: false`, timeouts y límite de salida), `NativeFolderPicker` (macOS/Windows/Linux), `RepoFileWalker` (solo lectura con límites de archivos/tamaño), `config/loadDotEnv.ts`, clientes opcionales (`integrations/`), escáneres (`scanners/`) y las 7 estaciones (`stations/`).
- `src/interfaces/`: `cli/`, `web/` (+ `public/`) y `mcp/` (Servidor Stdio + MCP App UI).
- `extensions/vscode-itv/`: extensión de barra lateral VS Code / Open VSX (`extension.ts`, `ItvTreeProvider.ts`, `ItvWebviewProvider.ts`, `IntegrationsStore.ts`) empaquetada por `scripts/build-vscode-extension.mjs`.

## 5. Restricciones de Negocio, Seguridad y Modelo de Amenaza
- **100% local y 0 cuentas obligatorias:** sin base de datos externa, sin telemetría ni API keys obligatorias.
- **Sin ejecución insegura:** prohibido concatenar rutas de usuario en strings de shell (`exec`); usar siempre `spawn` con `shell: false`, argumentos en array, timeouts estrictos, `AbortSignal` y validación de que `repoPath` exista y sea directorio.
- **Modelo de amenaza (repositorios de confianza):** las Estaciones 3 y 5 ejecutan los scripts de pruebas del propio repositorio inspeccionado (`npm test`, `phpunit`, `pytest`, Playwright). Por tanto, la ITV debe ejecutarse **únicamente sobre repositorios propios o de confianza**, nunca sobre código no verificado de terceros sin aislamiento de contenedor/VM.
- **Solo lectura sobre el repo inspeccionado:** la ITV nunca modifica ni elimina archivos del repositorio objetivo.
- **Cero falsos verdes:** el CLI sale con código `!= 0` ante cualquier fallo bloqueante (`DESFAVORABLE`).
- **Protección de secretos:** los tokens opcionales (`.env` con `chmod 600` o `SecretStorage` cifrado del SO) nunca se envían al navegador ni se incluyen en reportes exportados.

## 6. Design System (UI Web, MCP App y Extensión)
- Estética **Dark Mode Técnico** (fondo `#0b0f17`, tarjetas `#121826`, bordes `#1e293b`, contraste WCAG 2.1 AA validado).
- Semáforo ITV uniforme: Verde `#22c55e` (Apto), Ámbar `#f59e0b` (Observación), Rojo `#ef4444` (Desfavorable — bloquea push).

## 7. Pipeline y Verificación Local
Proyecto 100% local (sin VPS de producción) con CI oficial en GitHub Actions:
1. `npm run typecheck` (`tsc --noEmit`) + `npx tsc -p extensions/vscode-itv/tsconfig.json --noEmit`
2. `npm run test:coverage` (Vitest, cobertura `>= 75%`)
3. `npm run test:e2e` (Playwright E2E)
4. `npm run audit:deps` (`npm audit`, 0 CVEs)
5. `npm run build` (motor + MCP App) y `npm run build:vscode` (extensión `.vsix`)
6. Auto-inspección: `npm run itv -- . --fast` o herramienta MCP `itv-calidad → run_itv` (**7/7 APTO**).

## 8. Protocolo Obligatorio de Relevo Seguro entre Modelos (Handoff Sin Regresiones)
Al continuar trabajo de turnos anteriores o tras `<USER_SETTINGS_CHANGE>`:
1. Leer `MEMORY.md`, `AGENTS.md`, `.agents/AGENTS.md` y correr `git status`, `git log --oneline -5` y `git diff` antes de editar nada.
2. Prohibido `git checkout <commit/tag> -- <archivo>` o `git restore` sin auditar el diff línea por línea y pedir confirmación explícita a Martín.
3. Verificar integridad de assets/builds antes y después de compilar; nunca sobrescribir CSS/JS compilados con salidas parciales.
4. Cero cambios visuales o arquitectónicos no solicitados: diagnosticar la causa raíz exacta antes de editar.
