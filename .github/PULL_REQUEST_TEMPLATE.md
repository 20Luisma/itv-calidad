## Resumen / Summary
Describe brevemente qué cambia este PR y por qué.

## Checklist de calidad / Quality Gate
- [ ] `npm run typecheck` pasa con 0 errores
- [ ] `npm run test:coverage` pasa con cobertura >= 75%
- [ ] `npm run audit:deps` reporta 0 vulnerabilidades (CVEs)
- [ ] `npm run itv -- . --fast` termina en `APTO`
- [ ] Si afecta a la extensión VS Code: `npx tsc -p extensions/vscode-itv/tsconfig.json --noEmit && npm run build:vscode`
- [ ] Sin secretos, tokens ni rutas locales hardcodeadas
