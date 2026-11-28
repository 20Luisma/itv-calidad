# 🛡️ ITV Code Gate (`itv-calidad`)

> **Did your AI agent say "everything passes" before `git push`? Verify it locally in 10 seconds.**

🌐 **Language / Idioma:** [🇪🇸 Español](README.md) | **🇬🇧 English (current)**

[![CI — ITV de Código](https://github.com/20Luisma/itv-calidad/actions/workflows/ci.yml/badge.svg)](https://github.com/20Luisma/itv-calidad/actions/workflows/ci.yml)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-ITV%20de%20C%C3%B3digo-007ACC?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=20luisma.itv-calidad-vscode)
[![Open VSX Registry](https://img.shields.io/badge/Open%20VSX-Antigravity%20%C2%B7%20Cursor%20%C2%B7%20Windsurf-A60EE5)](https://open-vsx.org/extension/20luisma/itv-calidad-vscode)
[![npm](https://img.shields.io/npm/v/itv-calidad?logo=npm&color=CB3837&label=npm)](https://www.npmjs.com/package/itv-calidad)
[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-Action-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/itv-code-gate-7-station-quality-security-audit)
[![Glama MCP](https://img.shields.io/badge/Glama%20MCP-TDQS%20A-10B981)](https://glama.ai/mcp/servers/20Luisma/itv-calidad)
[![M8ven Score](https://m8ven.ai/badge/mcp/20luisma-itv-calidad-ksuhsn?v=c7fd12a82c8e9dddf091f2381441116a)](https://m8ven.ai/mcp/20luisma-itv-calidad-ksuhsn?s=readme)

### Try it right now in 1 line *(zero clone, zero accounts, 100% read-only)*

```bash
npx -y itv-calidad . --fast --lang en
```

Auto-detects your stack (**Node/TS, PHP, Python, .NET/C#, Go, or Flutter/Dart**) and checks **syntax, static types, tests, leaked secrets, dependency CVEs, WCAG accessibility, and code health** before you push. **Never modifies or deletes any file.**

- 🧩 **Prefer a visual sidebar in your IDE?** [Install on VS Code](https://marketplace.visualstudio.com/items?itemName=20luisma.itv-calidad-vscode) · [Install on Cursor / Windsurf / Antigravity](https://open-vsx.org/extension/20luisma/itv-calidad-vscode)
- 🤖 **Using AI agents (MCP) or GitHub Actions?** Add `npx -y itv-calidad --mcp` or `uses: 20Luisma/itv-calidad@v1.6.1`.

![Live demo of the ITV de Código VS Code sidebar extension (7 stations + traffic light + findings tree)](docs/assets/itv-vscode-demo.gif)

### Pick how you want to use it *(same 7-station engine)*

| If you want to… | Use this | Get started in 10 seconds |
|---|---|---|
| **Audit any folder immediately** | **CLI (`npx`)** | `npx -y itv-calidad . --fast --lang en` |
| **Visual traffic-light sidebar in your IDE** | **VS Code / Open VSX Extension** | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=20luisma.itv-calidad-vscode) · [Open VSX](https://open-vsx.org/extension/20luisma/itv-calidad-vscode) |
| **Have your AI agent run it before pushing** | **MCP Server + MCP App** | `npx -y itv-calidad --mcp` ([setup guide](#option-1--interactive-mcp-app--mcp-server-antigravity-cursor-claude-code)) |
| **Block bad `git push` automatically** | **Portable `pre-push` hook (0 tokens)** | `npx -y itv-calidad --init-hook` |
| **Post sticky reports on Pull Requests** | **Official GitHub Action** | `uses: 20Luisma/itv-calidad@v1.6.1` |

---

## What it actually does (and what it does NOT do)

### What it DOES (100% real, zero simulations)
- **Runs real tools** against your local repository (**Node.js/TypeScript, PHP, Python, .NET/C#, Go, or Flutter/Dart**, including mixed or manifest-free repos) preserving real exit codes (**zero false greens**).
- **Blocks `git push` (`exit code != 0`)** whenever any mandatory station fails (syntax, static types, tests/coverage, CVEs/secrets, E2E, or critical accessibility).
- **Honestly marks inapplicable stations as `OMITIDA` (Skipped)** (e.g., if Playwright is not installed), explaining how to add them if you want.
- **Reports diagnostic scope & confidence (`Full inspection`, `Partial inspection`, or `Static diagnostic only`):** never confuses *"0 failures in partial checks"* with *"production-ready"*, explicitly listing missing critical layers (types, tests, or E2E).
- **Generates a Security Due-Diligence Checklist** (based on OWASP ASVS Level 1 and GDPR Art. 32 technical controls) with timestamped **Markdown (`.md`) and JSON (`.json`) evidence export**.
- **Embedded interactive cockpit inside your IDE (MCP App & VS Code Extension):** dark-mode traffic light, animated station scan, jump-to-file/line findings tree, encrypted `SecretStorage` integrations panel, and one-click *"Fix with agent"* prompt.

### What it does NOT do (full transparency)
- **Complements GitHub Actions / CI — does not replace it:** acts as a **fast local pre-push barrier** (preventing leaked secrets, type errors, or CVEs from reaching Git), while cloud CI + Branch Protection remain recommended for teams and production deployments.
- **Does not replace** a professional penetration test, enterprise SAST (SonarQube / CodeQL / Semgrep), or formal security audit for critical/regulated systems.
- **Not legal advice:** the operational/contractual checklist block (DPA, encrypted backups, 72h breach response) is a technical best-practice guide based on OWASP/GDPR.
- **Run only on trusted repositories:** although the tool is read-only and executes commands via `spawn` with `shell: false`, Stations 3 and 5 execute the target repository's own test suites (`npm test`, `phpunit`, `pytest`, Playwright). Do not run it on untrusted third-party repositories outside an isolated container or VM.
- **Never installs or mutates dependencies in the target repo:** uses binaries already available on your machine or inside the target project's `node_modules`/`vendor`.
- **Cross-platform (macOS, Windows, Linux):** native folder picker in all 3 OSes (Finder on macOS, PowerShell dialog on Windows, `zenity`/`kdialog` on Linux), plus manual path input and CLI.

---

## Requirements

- **Node.js `>= 20`** (LTS recommended) and `npm`.
- Only the local tools for the stack you want to inspect:
  - **Node / TypeScript:** `npm`, project `tsc`, `vitest`/`jest`.
  - **PHP:** `php`, `composer`, `vendor/bin/phpstan`, `vendor/bin/phpunit`.
  - **Python:** `python3`, `pytest`, `mypy` or `ruff`, `pip-audit`.
  - **.NET / C#:** `dotnet` (`dotnet build`, `dotnet test`, `dotnet list package --vulnerable`).
  - **Go:** `go` (`go vet`, `go test -cover`), `govulncheck`.
  - **Flutter / Dart:** `dart` (`dart analyze`), `flutter test` / `dart test`.
  - **Optional (live WCAG 2.1 AA on a local URL):** `npm install -g pa11y` (auto-detects local Chrome/Chromium/Brave on macOS/Windows/Linux).

---

## Quick Install

**Zero-clone (`npx`, recommended for CLI & MCP):**
```bash
# Inspect the current repository in fast mode
npx -y itv-calidad . --fast

# Install the portable pre-push hook in 1 command (0 AI tokens)
npx -y itv-calidad --init-hook

# Start the Stdio MCP Server (+ embedded MCP App)
npx -y itv-calidad --mcp
```

**In GitHub Actions (automated sticky PR summary comment):**
```yaml
- uses: 20Luisma/itv-calidad@v1.6.1
  with:
    min-coverage: '75'
    lang: 'en'
```

**From source (local clone):**
```bash
git clone https://github.com/20Luisma/itv-calidad.git
cd itv-calidad
npm install
npm run build
```

---

## Option 1 — Interactive MCP App & MCP Server (Antigravity, Cursor, Claude Code)

`itv-calidad` ships an official **Stdio MCP Server** with an **embedded MCP App UI** (`ui://itv-calidad/app.html` built on `@modelcontextprotocol/ext-apps`). In compatible hosts (Antigravity, Claude Desktop, VS Code), running `run_itv` renders the interactive cockpit directly inside chat and the side pane.

![Live demo of ITV de Código MCP App embedded in Antigravity](docs/assets/itv-mcp-demo.gif)

### 1. Register the MCP server in your IDE / Agent
- **Antigravity:** `~/.gemini/antigravity/mcp_config.json` *(restart Antigravity completely after editing to load the MCP App)*
- **Cursor:** `.cursor/mcp.json` or `~/.cursor/mcp.json`
- **Claude Desktop / Claude Code:** `claude_desktop_config.json` or:
  ```bash
  claude mcp add itv-calidad -- npx -y itv-calidad --mcp
  ```

```json
{
  "mcpServers": {
    "itv-calidad": {
      "command": "npx",
      "args": ["-y", "itv-calidad", "--mcp"],
      "env": {
        "SONAR_TOKEN": "(optional)",
        "SENTRY_AUTH_TOKEN": "(optional)",
        "SENTRY_ORG": "(optional)",
        "SENTRY_PROJECT": "(optional)",
        "GITHUB_TOKEN": "(optional)"
      }
    }
  }
}
```
*(If you prefer running from a local clone without `npx`, use `"command": "node"` and `"args": ["/absolute/path/to/itv-calidad/dist/interfaces/mcp/server.js"]`. The `"env"` block is 100% optional: omit it to run completely offline with zero accounts.)*

### 2. Automatic pre-push rule for `GEMINI.md` / `AGENTS.md` / `CLAUDE.md`

Paste this rule into your global `~/.gemini/GEMINI.md` or project `AGENTS.md` / `CLAUDE.md` so your AI agent runs the gate **automatically before every `git push`, tag, or deploy**:

```markdown
## Automatic ITV Quality Gate (Pre-Push / Pre-Deploy)
Before any `git push` to `main`, stable tag creation, or production deployment:
1. Call the MCP tool `itv-calidad` → `run_itv` passing the absolute project path (`repoPath`).
   *(CLI fallback only if MCP is unavailable: `cd /absolute/path/to/itv-calidad && npm run itv -- <repo_path> --fast`)*.
2. **DESFAVORABLE (Stations 1–4: syntax, types, tests/coverage, security/secrets/CVEs):** BLOCKS push/deploy. Fix all findings and re-verify before proceeding.
3. **OBSERVACIONES (Stations 5–7: E2E, WCAG, code health/observability):** report a 1-line summary and ask whether to polish before closing the release.
```

### 3. Exposed MCP Tools
| Tool | Description |
|---|---|
| `run_itv` | Runs all 7 stations on `repoPath`, renders the embedded MCP App cockpit (`ui://itv-calidad/app.html`), and returns structured JSON or Markdown (`minCoverage` and `targetUrl` optional). |
| `get_security_checklist` | Runs Station 4 and returns the OWASP ASVS Level 1 / GDPR Art. 32 due-diligence checklist. |
| `list_itv_stations` | Lists all 7 stations and their technical scope without executing commands. |

---

## Option 2 — Local Web Dashboard (Slow-Motion SSE)

```bash
npm run start
# Open in browser: http://127.0.0.1:4173
```

---

## Option 3 — CLI Mode (Terminal / `pre-push` Hook)

```bash
npm run itv -- .
npm run itv -- /path/to/your/project --fast
npm run itv -- /path/to/your/project --min-coverage 80 --url http://127.0.0.1:3000
npm run itv -- /path/to/your/project --markdown > itv-evidence.md
npm run itv -- /path/to/your/project --json > itv-evidence.json
```

**CLI exit codes:**
- `0` → `APTO` or `APTO_CON_OBSERVACIONES` (safe to push).
- `1` → `DESFAVORABLE` (blocking failure detected).
- `2` → Invocation error (e.g. invalid path).

---

## Option 4 — Sidebar IDE Extension (VS Code Marketplace & `.vsix` for Antigravity / Cursor / Windsurf)

Install the native sidebar extension with a dedicated shield icon in the Activity Bar, live traffic light cockpit, clickable 7-station tree with jump-to-file/line, encrypted `SecretStorage` integrations panel, and status bar badge:

- **1-click install from Visual Studio Code Marketplace (VS Code):**
  👉 **[Install ITV de Código on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=20luisma.itv-calidad-vscode)**
- **1-click install from Open VSX Registry (Antigravity, Cursor, Windsurf, VSCodium):**
  👉 **[Install ITV de Código on Open VSX Registry](https://open-vsx.org/extension/20luisma/itv-calidad-vscode)**
- **Via VS Code CLI:**
  ```bash
  code --install-extension 20luisma.itv-calidad-vscode
  ```
- **Build & install local `.vsix` (Antigravity, Cursor, Windsurf, VS Code):**
  ```bash
  npm run build:vscode
  # Outputs: dist/itv-calidad-vscode-1.3.0.vsix
  ```
  Then in your IDE: `Cmd/Ctrl + Shift + P` → **Install from VSIX…** → select `dist/itv-calidad-vscode-1.3.0.vsix`.

---

## The 7 Inspection Stations

| # | Station | What it checks | Tools executed |
|---|---|---|---|
| **1** | **Syntax & Config** | Code parses cleanly and project manifests are valid | `JSON.parse(package.json)`, `npm run lint` / `node --check`, `composer validate --strict`, `php -l`, `python3 -m py_compile` |
| **2** | **Static Type Analysis** | Type bugs, null safety, and broken contracts before runtime | `tsc --noEmit`, `vendor/bin/phpstan analyse`, `mypy .` / `ruff check .` |
| **3** | **Tests & Coverage** | Automated local test suite + configurable coverage gate (default `75%`) | `npm run test:coverage` / `npm test`, `vendor/bin/phpunit`, `pytest -q` |
| **4** | **Security, CVEs & Due Diligence** | Dependency CVEs + hardcoded secret/IP/`eval()`/`shell: true` scanner + OWASP/GDPR checklist | `npm audit`, `composer audit`, `pip-audit` + built-in local scanners |
| **5** | **Browser E2E Tests** | Real user flows and negative paths if the repo includes E2E tests | `npm run test:e2e`, `npm run e2e`, or `playwright test` |
| **6** | **Accessibility & UI Quality** | WCAG 2.1 AA compliance on views and/or live local URL | `npm run test:a11y`, `pa11y --standard WCAG2AA <url>` + static scanner on `.html/.htm/.php/.jsx/.tsx/.vue` |
| **7** | **Code Health & Observability** | Local static analysis (large files, cyclomatic complexity, DRY duplicates, `debugger`/`var_dump`, Sentry/log checks) + **optional live SonarCloud, Sentry & GitHub Security connectors** | Local scanner (0 accounts) + optional API integration via `.env` / `SecretStorage` |

---

## Architecture & Self-Inspection

This repository follows lightweight Clean Architecture, strict HTML/CSS/JS separation (strict CSP with no unsafe inline logic), and passes its own **7/7 APTO** inspection:

- `src/domain/` — Pure types, station catalog, and verdict calculation (zero Node/HTTP dependencies).
- `src/application/` — `DetectRepoStack`, `RunItvInspection`, and `ExportReportMarkdown`.
- `src/infrastructure/` — `SafeCommandExecutor` (`spawn` with `shell: false` and timeouts), `RepoFileWalker`, scanners, optional API clients, and the 7 stations.
- `src/interfaces/` — CLI (`cli/`), HTTP/SSE Web Dashboard (`web/` + `public/`), and Stdio MCP Server + MCP App (`mcp/`).
- `extensions/vscode-itv/` — Native VS Code / Open VSX sidebar extension reusing the same core engine.

```bash
npm run typecheck       # TypeScript strict (0 errors)
npm run test:coverage   # Isolated Vitest suite + coverage gate (>75%)
npm run audit:deps      # npm audit (0 CVEs)
npm run itv -- . --fast # 7/7 self-inspection
```

## Technical Documentation
- [AGENTS.md](AGENTS.md) — Engineering protocol and project contracts.
- [SECURITY.md](SECURITY.md) — Safe execution policy and threat model for trusted repositories.
