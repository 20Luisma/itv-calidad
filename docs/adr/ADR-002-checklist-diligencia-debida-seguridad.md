# ADR-002: Checklist de Tranquilidad / Diligencia Debida en Seguridad

- **Fecha:** 2026-11-23
- **Estado:** Aceptado

## Contexto
Ante incidentes de seguridad o filtraciones de datos, la diferencia entre un incidente fortuito y una negligencia sancionable radica en demostrar **diligencia debida** (medidas técnicas y organizativas apropiadas según OWASP ASVS Nivel 1 y Art. 32 del RGPD). Los desarrolladores necesitan una forma rápida y local de comprobar los controles técnicos mínimos y generar evidencia fechada antes de cada entrega o `git push`.

## Decisión
Integrar en la **Estación 4 (Seguridad y CVEs)** y en el **Dashboard Web / Exportador Markdown** un **Checklist de Tranquilidad / Diligencia Debida** dividido en dos bloques:
1. **Controles técnicos verificados automáticamente** sobre el repositorio (`.env` en `.gitignore`, cero secretos hardcodeados, cero IPs `http://`, auditoría de CVEs + lockfile, ausencia de `eval()`/`shell: true`, detección de cabeceras HTTP de seguridad).
2. **Controles operativos y contractuales fuera del código** (contrato + DPA RGPD Art. 28, hashing fuerte + MFA, backups cifrados + plan 72h, archivo de evidencias pre-deploy), acompañados de un aviso explícito de que se trata de una guía técnica y no de asesoramiento jurídico formal.

## Consecuencias
- **Positivas:** la ITV no solo detecta fallos puntuales, sino que genera un informe de evidencia exportable (`.md` / `.json`) con fecha, rama Git y porcentaje de cumplimiento técnico.
- **Trade-offs:** las heurísticas estáticas (como la detección de cabeceras HTTP en código) pueden marcar `warn` en proyectos CLI/librerías puras, lo cual es deseable como recordatorio y no bloquea el push.
