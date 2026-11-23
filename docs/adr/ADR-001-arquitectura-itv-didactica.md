# ADR-001: Arquitectura Local de la ITV Didáctica de Código

- **Fecha:** 2026-11-23
- **Estado:** Aceptado

## Contexto
Al trabajar con agentes IA o aprender buenas prácticas de calidad (tests, análisis estático, seguridad, accesibilidad), los pipelines en la nube suelen verse como una "caja negra" que falla lejos del desarrollador. Se necesita una herramienta **100% local**, previa al `git push`, que ejecute controles reales de nivel profesional paso a paso ("cámara lenta") y explique didácticamente qué revisa cada estación y cómo corregir cada fallo, sin requerir cuentas externas ni API keys.

## Decisión
1. **Stack del motor:** Node.js + TypeScript (`strict: true`) con arquitectura limpia ligera (`domain / application / infrastructure / interfaces`).
2. **Doble interfaz sobre el mismo motor:**
   - **CLI** para ejecución rápida en terminal antes del push (exit code `!= 0` si alguna estación obligatoria falla).
   - **Dashboard Web local** (HTML/CSS/JS modular externo, sin frameworks pesados) conectado por **SSE (Server-Sent Events)** para visualizar las 6 estaciones en cámara lenta.
3. **Solo lectura y seguridad:** la ITV ejecuta comandos mediante `spawn` con argumentos en array (sin concatenación de shell) y nunca modifica archivos del repositorio inspeccionado.
4. **6 Estaciones estándar:** Sintaxis/Config → Tipos → Tests/Cobertura → Seguridad/CVEs → E2E → Accesibilidad/UI. Si una estación no aplica al stack detectado, reporta `skipped` con explicación clara (cero falsos verdes).

## Consecuencias
- **Positivas:** cero dependencias de terceros/cuentas, reutilizable sobre repos PHP, Node.js o Python, fácil de testear con Vitest y muy claro para aprendizaje.
- **Trade-offs:** las estaciones de cada stack requieren que el binario correspondiente (`php`, `composer`, `npm`, `python3`) esté instalado en la máquina local; si falta, la estación lo reporta explícitamente con instrucciones de instalación.
