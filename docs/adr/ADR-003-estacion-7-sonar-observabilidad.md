# ADR-003: Estación 7 — Calidad Sonar y Observabilidad (Sentry) 100% Local

- **Fecha:** 2026-11-23
- **Estado:** Aceptado

## Contexto
Además de sintaxis, tipos, tests, CVEs, E2E y accesibilidad, los proyectos reales acumulan deuda técnica (archivos monolíticos, complejidad alta, duplicación DRY, `debugger`/`var_dump` olvidados) y errores silenciosos en producción cuando no cuentan con observabilidad fail-safe o cuando configuran mal Sentry (DSN hardcodeado o `sendDefaultPii: true` sin control RGPD).

## Decisión
Agregar una **Estación 7 (`code-health-observability`)** 100% local y sin cuentas obligatorias compuesta por:
1. **`CodeHealthSonarScanner`:** analiza tamaño de archivos, complejidad ciclomática aproximada, bloques duplicados entre archivos (ventana normalizada de 8 líneas), `debugger;` (`error` bloqueante) y `var_dump`/`dd` en PHP (`warning`), además de detectar `sonar-project.properties`.
2. **`ObservabilitySentryScanner`:** detecta SDKs de Sentry/loggers/handlers globales, bloquea cualquier **Sentry DSN hardcodeado** (`error`), advierte `sendDefaultPii: true` bajo RGPD (`warning`) y sugiere observabilidad fail-safe (`info` no bloqueante) si no existe ninguna capa de monitoreo.

## Consecuencias
- **Positivas:** aporta controles prácticos estilo Sonar + auditoría pre-push de Sentry en milisegundos, sin levantar servidores Java ni requerir cuentas externas.
- **Trade-offs:** la complejidad ciclomática y duplicación se estiman por análisis léxico ligero; para auditorías profundas multi-lenguaje sigue siendo compatible con `sonar-project.properties` en CI.
