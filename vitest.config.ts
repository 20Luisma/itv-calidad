import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/interfaces/cli/index.ts',
        'src/interfaces/web/server.ts',
        'src/interfaces/mcp/server.ts',
        'src/interfaces/mcp/ui/**'
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
        statements: 75
      }
    }
  }
});
