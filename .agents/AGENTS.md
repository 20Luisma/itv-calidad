# Workspace Rules — ITV Didáctica de Código

- Leer siempre `AGENTS.md` y `MEMORY.md` en la raíz antes de tocar código.
- Mantener separación estricta: `src/domain` sin dependencias de Node/HTTP; `public/` con HTML semántico, CSS modular y JS externo (sin `<style>` ni `<script>` inline con lógica).
- Nunca modificar archivos del repositorio objetivo inspeccionado por la ITV.
- Nunca silenciar exit codes en las estaciones (cero falsos verdes).
- **Cláusula obligatoria de Relevo Seguro (Handoff):** al continuar trabajo previo o tras cambio de modelo (`<USER_SETTINGS_CHANGE>`), leer `MEMORY.md`, `AGENTS.md`, correr `git status`, `git log --oneline -5` y `git diff`; prohibido `git checkout <commit/tag> -- <archivo>` o `git restore` sin auditar diff y pedir permiso explícito a Martín; verificar integridad de bundles/assets y cero cambios visuales sin diagnosticar causa raíz.
