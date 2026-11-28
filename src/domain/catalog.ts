import type { StationId, StationMetadata } from './types.js';

export const STATION_CATALOG: Readonly<Record<StationId, StationMetadata>> = {
  'syntax-config': {
    id: 'syntax-config',
    order: 1,
    name: 'Estación 1 — Sintaxis y Configuración',
    shortName: 'Sintaxis y Config',
    didactic: {
      whatItChecks:
        'Comprueba que los archivos de código parseen sin errores de sintaxis y que los manifiestos del proyecto (package.json, composer.json, pyproject.toml) estén íntegros y bien formados.',
      whyItMatters:
        'Un error de sintaxis o un manifiesto roto detiene el despliegue o rompe el entorno de cualquier compañero apenas hace git pull.',
      toolsByStack: 'PHP: php -l | Node/TS: node --check + eslint | Python: py_compile | .NET: .csproj | Go: go.mod | Flutter: pubspec.yaml'
    }
  },
  'static-types': {
    id: 'static-types',
    order: 2,
    name: 'Estación 2 — Análisis Estático de Tipos',
    shortName: 'Tipos Estáticos',
    didactic: {
      whatItChecks:
        'Analiza el flujo de tipos y contratos sin ejecutar la aplicación para detectar nulos no controlados, propiedades inexistentes o firmas incompatibles.',
      whyItMatters:
        'Atrapa en segundos bugs silenciosos que de otro modo explotan en producción recién cuando un usuario cae en un caso borde.',
      toolsByStack: 'PHP: PHPStan | Node/TS: tsc --noEmit | Python: mypy/ruff | .NET: dotnet build | Go: go vet | Flutter/Dart: dart analyze'
    }
  },
  'tests-coverage': {
    id: 'tests-coverage',
    order: 3,
    name: 'Estación 3 — Tests Automáticos y Cobertura',
    shortName: 'Tests y Cobertura',
    didactic: {
      whatItChecks:
        'Ejecuta la suite local de pruebas automáticas y verifica si la cobertura de código alcanza el umbral mínimo exigido (coverage gate).',
      whyItMatters:
        'Es la red de seguridad contra regresiones: garantiza que un cambio nuevo no rompió comportamiento crítico que ya funcionaba.',
      toolsByStack: 'PHP: PHPUnit | Node/TS: Vitest/Jest | Python: Pytest | .NET: dotnet test | Go: go test -cover | Flutter/Dart: flutter/dart test'
    }
  },
  'security-cves': {
    id: 'security-cves',
    order: 4,
    name: 'Estación 4 — Seguridad y Dependencias (CVEs)',
    shortName: 'Seguridad y CVEs',
    didactic: {
      whatItChecks:
        'Audita vulnerabilidades conocidas (CVEs) en las dependencias instaladas y escanea el código fuente en busca de secretos, API keys o IPs http:// hardcodeadas.',
      whyItMatters:
        'Subir una credencial a Git o desplegar una librería vulnerable expone infraestructura y datos de usuarios al instante.',
      toolsByStack: 'composer/npm/pip-audit + dotnet vulnerable + govulncheck + escáner local de secretos e IPs'
    }
  },
  'e2e-browser': {
    id: 'e2e-browser',
    order: 5,
    name: 'Estación 5 — Pruebas E2E en Navegador',
    shortName: 'E2E Navegador',
    didactic: {
      whatItChecks:
        'Ejecuta flujos completos de usuario en un navegador real (incluyendo caminos negativos como 404, auth o validaciones) cuando el proyecto cuenta con suite E2E.',
      whyItMatters:
        'Los tests unitarios pueden pasar en verde y aun así el usuario no poder completar un flujo real por un fallo de integración frontend-backend.',
      toolsByStack: 'Playwright (playwright.config.* / script test:e2e)'
    }
  },
  'accessibility-ui': {
    id: 'accessibility-ui',
    order: 6,
    name: 'Estación 6 — Accesibilidad y Calidad UI',
    shortName: 'Accesibilidad UI',
    didactic: {
      whatItChecks:
        'Revisa cumplimiento WCAG 2.1 AA con herramientas del repo (Axe, Pa11y, Lighthouse) y realiza un escaneo estático de vistas (alt en imágenes, labels, lang, links y headings).',
      whyItMatters:
        'Una interfaz inaccesible excluye usuarios con lectores de pantalla o navegación por teclado y suele empeorar SEO y mantenibilidad.',
      toolsByStack: '@axe-core/playwright / Pa11y / Lighthouse + auditoría estática HTML'
    }
  },
  'code-health-observability': {
    id: 'code-health-observability',
    order: 7,
    name: 'Estación 7 — Deuda Técnica y Observabilidad (Sonar / Sentry)',
    shortName: 'Deuda & Obs.',
    didactic: {
      whatItChecks:
        'Ejecuta análisis local de deuda técnica (tamaño, complejidad, duplicados, restos de debug) y observabilidad pre-push; si configuras SONAR_TOKEN o SENTRY_AUTH_TOKEN en tu .env local, consulta en vivo SonarCloud y Sentry con enlaces directos.',
      whyItMatters:
        'Evita acumular código inmantenible y te deja ver el Quality Gate real de SonarCloud y los errores abiertos en Sentry antes de hacer git push.',
      toolsByStack: 'Análisis local (0 cuentas) + API opcional SonarCloud / Sentry vía .env'
    }
  }
};

export const ORDERED_STATION_IDS: readonly StationId[] = [
  'syntax-config',
  'static-types',
  'tests-coverage',
  'security-cves',
  'e2e-browser',
  'accessibility-ui',
  'code-health-observability'
];
