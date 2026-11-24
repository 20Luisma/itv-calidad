# Contributing / Contribuir a ITV de Código (`itv-calidad`)

## 🇪🇸 Cómo contribuir (Español)

¡Gracias por tu interés en mejorar **ITV de Código**!

### Flujo rápido en local
```bash
git clone https://github.com/20Luisma/itv-calidad.git
cd itv-calidad
npm install
npm run typecheck
npm run test:coverage
npm run itv -- . --fast
```

### Reglas del proyecto
1. **Arquitectura limpia:** `src/domain/` no debe importar módulos de Node ni HTTP.
2. **Solo lectura sobre repositorios inspeccionados:** ninguna estación puede modificar ni eliminar archivos del proyecto objetivo.
3. **Ejecución segura:** usar siempre `SafeCommandExecutor` (`spawn` con `shell: false`, timeouts y `AbortSignal`).
4. **Cero falsos verdes y 0 CVEs:** todo PR debe pasar `npm run typecheck`, `npm run test:coverage` (`>= 75%`), `npm run audit:deps` y `npm run itv -- . --fast`.
5. **Commits atómicos:** usa prefijos claros (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).

---

## 🇬🇧 How to contribute (English)

Thanks for helping improve **ITV de Código**!

### Local setup
```bash
git clone https://github.com/20Luisma/itv-calidad.git
cd itv-calidad
npm install
npm run typecheck
npm run test:coverage
npm run itv -- . --fast
```

### Project guidelines
1. **Clean Architecture:** keep `src/domain/` pure (no Node/HTTP imports).
2. **Strictly read-only on target repos:** stations must never mutate or delete files in inspected repositories.
3. **Safe process execution:** always use `SafeCommandExecutor` (`spawn` with `shell: false`, timeouts, and `AbortSignal`).
4. **Zero false greens & 0 CVEs:** every PR must pass `npm run typecheck`, `npm run test:coverage` (`>= 75%`), `npm run audit:deps`, and `npm run itv -- . --fast`.
5. **Atomic commits:** follow conventional prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
