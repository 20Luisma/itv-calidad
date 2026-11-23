# ITV Didáctica de Código

Herramienta **100% local** (CLI + Dashboard Web en cámara lenta) que inspecciona cualquier repositorio local **antes de hacer `git push`** pasando por **6 estaciones de calidad** de nivel profesional, explicando de forma clara qué audita cada estación, por qué importa y cómo corregir los fallos.

> **Uso local:** corre íntegramente en tu Mac sin cuentas externas, sin tokens pagos, con 0 CVEs y sin modificar archivos del repositorio inspeccionado.

## Uso Local Rápido (1 línea)

```bash
# Instalar dependencias (solo primera vez)
npm install

# 1. Modo CLI (cámara lenta en terminal, listo para pre-push)
npm run itv -- /ruta/a/tu/repo

# 2. Modo Dashboard Web local (cámara lenta vía SSE + Checklist de Seguridad)
npm run dev
# Abrir http://127.0.0.1:4173
```

### Opciones útiles del CLI
```bash
npm run itv -- . --fast                 # Sin pausas de cámara lenta
npm run itv -- . --min-coverage 80      # Exigir 80% de cobertura mínima
npm run itv -- . --markdown > itv.md    # Exportar evidencia en Markdown
npm run itv -- . --json > itv.json      # Exportar reporte estructurado en JSON
```

## Las 6 Estaciones de la ITV

| # | Estación | Qué revisa | Herramientas soportadas |
|---|---|---|---|
| 1 | **Sintaxis y configuración** | Manifiestos válidos y código sin errores de parseo | `php -l`, `composer validate --strict`, `node --check`, `npm run lint`, `py_compile` |
| 2 | **Análisis estático de tipos** | Bugs de tipos antes de ejecutar la app | `tsc --noEmit`, PHPStan, `mypy` / `ruff` |
| 3 | **Tests y cobertura** | Suite local en verde + *coverage gate* configurable (default `75%`) | Vitest, Jest, PHPUnit, Pytest |
| 4 | **Seguridad, CVEs y Diligencia Debida** | CVEs en dependencias + escáner de secretos/IPs `http://` + **Checklist de Tranquilidad OWASP ASVS / RGPD Art. 32** | `npm audit`, `composer audit`, `pip-audit`, escáneres locales |
| 5 | **Pruebas E2E en navegador** | Flujos reales de usuario si el repo tiene suite E2E | Playwright (`test:e2e` / `playwright.config.*`) |
| 6 | **Accesibilidad y calidad UI** | Cumplimiento WCAG 2.1 AA + auditoría estática HTML (`lang`, `alt`, `label`, `button`) | Axe / Pa11y / Lighthouse + escáner estático HTML |

## Checklist de Tranquilidad / Diligencia Debida en Seguridad
La Estación 4 y el Dashboard Web generan un bloque dedicado (exportable en **Markdown** y **JSON** como evidencia fechada del release) con:
- **Controles técnicos automáticos:** protección de `.env` en `.gitignore`, ausencia de claves/tokens hardcodeados, cero IPs `http://`, auditoría de CVEs + lockfile, ausencia de `eval()`/`shell: true` y cabeceras HTTP de seguridad.
- **Recordatorio operativo/contractual fuera del código:** contrato + DPA (RGPD Art. 28), hashing fuerte + MFA, backups cifrados + plan 72h y archivo de evidencias pre-deploy. *(Guía técnica OWASP/RGPD, no asesoramiento jurídico formal.)*

## Calidad Propia del Repositorio
```bash
npm run typecheck      # TypeScript strict (0 errores)
npm run test:coverage  # Vitest aislado + coverage gate
npm run audit:deps     # npm audit (0 CVEs)
```

## Documentación
- `AGENTS.md` — Protocolo técnico, arquitectura y reglas del proyecto.
- `MEMORY.md` — Contexto persistente y próximos pasos.
- `docs/adr/ADR-001-arquitectura-itv-didactica.md` — Decisión arquitectónica inicial.
- `docs/adr/ADR-002-checklist-diligencia-debida-seguridad.md` — Checklist de Tranquilidad en Seguridad.
