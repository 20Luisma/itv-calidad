# ITV Didáctica de Código

Herramienta **100% local** (CLI + Dashboard Web en cámara lenta) que inspecciona cualquier repositorio local **antes de hacer `git push`** pasando por **6 estaciones de calidad** de nivel profesional, explicando de forma clara qué audita cada estación, por qué importa y cómo corregir los fallos.

> **Uso local:** esta herramienta corre íntegramente en tu Mac sin cuentas externas, sin tokens pagos y sin modificar archivos del repositorio inspeccionado.

## Las 6 Estaciones de la ITV

| # | Estación | Qué revisa | Ejemplos de herramientas |
|---|---|---|---|
| 1 | **Sintaxis y configuración** | Que el código no tenga errores de sintaxis y los manifiestos sean válidos | `php -l`, `composer validate`, `node --check`, `py_compile` |
| 2 | **Análisis estático de tipos** | Bugs potenciales de tipos antes de ejecutar el código | PHPStan, `tsc --noEmit`, `ruff` / `mypy` |
| 3 | **Tests y cobertura** | Que la lógica siga funcionando y supere el umbral mínimo de cobertura | PHPUnit, Vitest, Pytest + *coverage gate* |
| 4 | **Seguridad y CVEs** | Vulnerabilidades conocidas en librerías + secretos o IPs `http://` en código | `composer audit`, `npm audit`, escáner local |
| 5 | **Pruebas E2E en navegador** | Flujos reales de usuario y casos negativos (404, CSRF, rate-limit) | Playwright |
| 6 | **Accesibilidad y calidad UI** | Contraste, etiquetas `alt`, ARIA y cumplimiento WCAG 2.1 AA | `@axe-core/playwright`, Pa11y, Lighthouse |

## Estado del Proyecto
- **Fase actual:** Bootstrap inicial completado (`AGENTS.md`, `MEMORY.md`, `ADR-001`, estructura base).
- **Siguiente fase:** Implementación del motor CLI + Dashboard Web local en Node.js / TypeScript.

## Uso Local (próximamente tras implementar el MVP)
```bash
# Modo CLI (cámara lenta en terminal)
npm run itv -- /ruta/a/tu/repo

# Modo Dashboard Web local
npm run dev
# Abrir http://localhost:4173
```

## Documentación
- `AGENTS.md` — Protocolo técnico, arquitectura y reglas del proyecto.
- `MEMORY.md` — Contexto persistente y próximos pasos.
- `docs/adr/ADR-001-arquitectura-itv-didactica.md` — Decisión arquitectónica inicial.
