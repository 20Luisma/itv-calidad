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
      toolsByStack: 'PHP: php -l + composer validate | Node/TS: node --check + eslint | Python: py_compile'
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
      toolsByStack: 'PHP: PHPStan | Node/TS: tsc --noEmit | Python: mypy / ruff'
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
      toolsByStack: 'PHP: PHPUnit | Node/TS: Vitest / Jest | Python: Pytest'
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
      toolsByStack: 'composer audit / npm audit / pip-audit + escáner local de secretos e IPs'
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
  }
};

export const ORDERED_STATION_IDS: readonly StationId[] = [
  'syntax-config',
  'static-types',
  'tests-coverage',
  'security-cves',
  'e2e-browser',
  'accessibility-ui'
];
