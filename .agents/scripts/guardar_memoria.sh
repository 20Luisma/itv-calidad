#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${REPO_ROOT}/memory_backups"
TIMESTAMP="$(date +"%Y-%m-%d_%H-%M")"
DEST="${BACKUP_DIR}/MEMORY_${TIMESTAMP}.md"

mkdir -p "${BACKUP_DIR}"
cp "${REPO_ROOT}/MEMORY.md" "${DEST}"
echo "✅ Backup de memoria creado: ${DEST}"
