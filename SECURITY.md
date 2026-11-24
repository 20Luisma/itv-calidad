# Security Policy / Política de Seguridad

## 🇪🇸 Política de Ejecución Segura (Español)

### 1. Modelo de amenaza y repositorios de confianza
**ITV de Código (`itv-calidad`)** está diseñado como herramienta de **solo lectura y 100% local**:
- Nunca modifica, crea ni elimina archivos dentro del repositorio inspeccionado.
- Todos los comandos del sistema se ejecutan mediante `child_process.spawn` con **`shell: false`**, argumentos en array (sin interpolación de shell), validación previa de directorio real, timeouts estrictos, `AbortSignal` y límites de memoria/archivos en `RepoFileWalker`.

**Advertencia importante sobre repositorios externos no confiables:**
Las Estaciones 3 y 5 ejecutan las suites de pruebas definidas por el propio repositorio inspeccionado (`npm test`, `phpunit`, `pytest`, Playwright). Al igual que ejecutar `npm test` manualmente, eso implica ejecutar código de pruebas perteneciente al proyecto objetivo.
- **Uso recomendado:** ejecutar únicamente sobre **repositorios propios o de confianza**.
- **Repositorios desconocidos o de terceros:** ejecutar siempre dentro de un **contenedor aislado (Docker) o máquina virtual descartable**, sin acceso a tus credenciales locales.

### 2. Gestión de credenciales opcionales
- La herramienta funciona **sin ninguna cuenta ni API key**.
- Si decides conectar integraciones opcionales (SonarCloud, Sentry, GitHub Security):
  - En la **Extensión VS Code**, los tokens se almacenan en **`SecretStorage`** (llavero cifrado del sistema operativo) y nunca se devuelven al Webview.
  - En el **Dashboard Web / CLI / MCP**, se leen desde `.env` local (`chmod 600`, excluido en `.gitignore`) o variables de entorno y nunca se incluyen en los reportes exportados (`.md` / `.json`).

### 3. Reporte de vulnerabilidades
Si detectas una vulnerabilidad de seguridad en `itv-calidad`, abre un **Private Security Advisory** en GitHub (`Security → Advisories → Report a vulnerability`) o contacta directamente por correo al mantenedor antes de publicarla abiertamente.

---

## 🇬🇧 Safe Execution Policy (English)

### 1. Threat model & trusted repositories
**ITV de Código (`itv-calidad`)** is built as a **100% local, read-only** pre-push auditor:
- It never modifies, creates, or deletes files in the inspected repository.
- External binaries run via `child_process.spawn` with **`shell: false`**, array arguments (preventing shell injection), strict directory validation, timeouts, `AbortSignal` cancellation, and bounded file/output limits.

**Important notice regarding untrusted repositories:**
Stations 3 and 5 execute the target repository's own test suites (`npm test`, `phpunit`, `pytest`, Playwright). Just like running `npm test` directly, this executes test code authored by the inspected project.
- **Recommended usage:** run only on **your own or trusted repositories**.
- **Untrusted / third-party repositories:** always run inside an **isolated container (Docker) or disposable VM** with no access to local credentials.

### 2. Optional credentials handling
- Works out of the box with **zero accounts or API keys**.
- Optional connectors (SonarCloud, Sentry, GitHub Security) use OS-encrypted **`SecretStorage`** (VS Code extension) or local gitignored `.env` (`chmod 600`) and are never exposed to webviews or exported reports.

### 3. Reporting a vulnerability
Please report security issues privately via GitHub **Security Advisories** (`Security → Advisories → Report a vulnerability`) so they can be patched before public disclosure.
