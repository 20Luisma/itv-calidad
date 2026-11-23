# AGENTS.md — ITV Didáctica de Código

> Protocolo oficial del proyecto. Leelo junto con `MEMORY.md` antes de tocar una sola línea de código.

## 1. Propósito del Proyecto
**ITV Didáctica de Código** es una herramienta **100% local (0 cuentas externas, 0 tokens pagos)** que corre **antes de hacer `git push`** sobre cualquier repositorio local (PHP, Node.js/TypeScript o Python) y ejecuta **6 estaciones de inspección en cámara lenta**, explicando de forma visual, humana y didáctica **qué audita cada estación, por qué importa y cómo corregir cada fallo**.

Nace como evolución práctica del estándar de calidad aplicado en `20Luisma/marvel`, pensado tanto para uso real en local como para enseñar calidad de software de forma comprensible.

## 2. Stack Tecnológico
- **Motor / CLI + Servidor local:** Node.js (LTS) + TypeScript (`strict: true`, `tsc --noEmit`).
- **UI Dashboard Web local:** HTML5 semántico + CSS modular externo con Design Tokens (dark mode premium, animaciones sutiles de paso por estación) + JavaScript ES Modules externo (cero `<style>` ni `<script>` inline con lógica).
- **Comunicación en vivo (cámara lenta):** Server-Sent Events (SSE) desde el servidor local hacia el dashboard para ir mostrando cada estación paso a paso.
- **Testing y Calidad propia del repo:** Vitest (unit/integración) + `tsc --noEmit` + `npm audit` (0 CVEs).

## 3. Las 6 Estaciones de la ITV (Orden Obligatorio)
1. **Estación 1 — Sintaxis y Configuración:** valida que el código compile/parsea y los manifiestos estén sanos (`php -l`, `composer validate --strict`, `eslint` / `node --check`, `python -m py_compile`).
2. **Estación 2 — Análisis Estático de Tipos:** detecta bugs antes de ejecutar (`phpstan`, `tsc --noEmit`, `ruff` / `mypy`).
3. **Estación 3 — Tests Automáticos y Cobertura:** ejecuta la suite local aislada (`phpunit`, `vitest`/`jest`, `pytest`) y valida umbral mínimo de cobertura (*coverage gate*, default `75%`).
4. **Estación 4 — Seguridad y Dependencias (CVEs):** audita librerías (`composer audit`, `npm audit`, `pip-audit`) + escaneo local de secretos, claves o IPs `http://` hardcodeadas en el código.
5. **Estación 5 — Pruebas E2E en Navegador:** verifica flujos reales de usuario y casos negativos (404, CSRF, rate-limit) con Playwright si el repo objetivo los tiene.
6. **Estación 6 — Accesibilidad y Calidad UI:** valida accesibilidad WCAG 2.1 AA (`@axe-core/playwright` / Pa11y / Lighthouse) explicando en criollo fallos como `alt`, contraste o etiquetas ARIA.

Cada estación debe devolver un contrato uniforme:
- `id`, `name`, `didacticExplanation` (qué audita y por qué importa), `command`, `status` (`pass` | `warn` | `fail` | `skipped`), `durationMs`, `summary`, `findings[]` (archivo, línea, motivo, cómo arreglarlo).
- **Regla de Oro de Diagnóstico:** si una estación falla, **nunca** devolver falso verde; si la herramienta no aplica al stack del repo objetivo, devolver `skipped` con explicación clara.

## 4. Arquitectura (Clean Architecture Ligera)
- `src/domain/`: tipos, contratos de `Station`, `InspectionReport`, `Finding`, `RepoStack`. Sin dependencias de Node/HTTP.
- `src/application/`: casos de uso (`DetectRepoStack`, `RunItvInspection` con soporte de modo cámara lenta y eventos SSE).
- `src/infrastructure/`: runners de cada estación (`src/infrastructure/stations/`), ejecutor seguro de comandos (`spawn` sin shell injection, timeouts estrictos), detector de secretos/IPs.
- `src/interfaces/cli/`: entrada CLI (`npx tsx src/interfaces/cli/index.ts <ruta-repo>`).
- `src/interfaces/web/`: servidor HTTP local + SSE + archivos estáticos en `public/` (`index.html`, `css/`, `js/`).

## 5. Restricciones de Negocio y Seguridad
- **100% local:** no requiere login, base de datos externa ni API keys.
- **Sin ejecución insegura:** prohibido concatenar rutas del usuario en strings de shell (`exec`); usar `spawn` con argumentos en array y validar que la ruta objetivo exista y sea directorio.
- **Solo lectura sobre el repo inspeccionado:** la ITV **nunca** modifica ni borra archivos del repositorio objetivo.
- **Cero falsos verdes:** el CLI debe salir con código `!= 0` si cualquier estación obligatoria da `fail`.

## 6. Design System (UI Web Local)
- Estética **Dark Mode Premium** (fondo `#0b0f17`, tarjetas con bordes sutiles `#1e293b`, glassmorphism suave).
- Semáforo de ITV claro: Verde `#22c55e` (Apto), Amarillo `#f59e0b` (Observación / Skipped), Rojo `#ef4444` (Desfavorable — bloquea push).
- Cada estación tiene panel desplegable con: *"¿Qué revisa esta estación?"*, *"Comando ejecutado"*, *"Salida real"* y *"Cómo arreglarlo"*.

## 7. Pipeline y Verificación Local
Proyecto 100% local (no tiene servidor VPS de producción):
1. `npm run typecheck` (`tsc --noEmit`)
2. `npm test` (Vitest)
3. `npm audit` (0 CVEs)
4. Prueba rápida en local: levantar dashboard o correr CLI contra un repo local (ej. `/tmp/marvel-audit` o el propio repo).

## 8. Protocolo Obligatorio de Relevo Seguro entre Modelos (Handoff Sin Regresiones)
Al continuar trabajo de turnos anteriores o tras `<USER_SETTINGS_CHANGE>`:
1. Leer `MEMORY.md`, `AGENTS.md`, `.agents/AGENTS.md` y correr `git status`, `git log --oneline -5` y `git diff` antes de editar nada.
2. Prohibido `git checkout <commit/tag> -- <archivo>` o `git restore` sin auditar el diff línea por línea y pedir confirmación explícita a Martín.
3. Verificar integridad de assets/builds antes y después de compilar; nunca sobrescribir CSS/JS compilados con salidas parciales.
4. Cero cambios visuales o arquitectónicos no solicitados: diagnosticar causa raíz exacta antes de editar.
