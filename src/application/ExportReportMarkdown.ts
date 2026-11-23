import type { InspectionReport, StationStatus } from '../domain/types.js';

function statusBadge(status: StationStatus): string {
  switch (status) {
    case 'pass':
      return 'APTO';
    case 'warn':
      return 'OBSERVACION';
    case 'fail':
      return 'DESFAVORABLE';
    case 'skipped':
      return 'OMITIDA';
  }
}

export function exportReportAsMarkdown(report: InspectionReport): string {
  const lines: string[] = [
    `# Informe ITV Didáctica de Código — ${report.stack.repoName}`,
    '',
    `- **Veredicto:** ${report.verdict} (${report.blocksPush ? 'BLOQUEA PUSH' : 'APTO PARA PUSH'})`,
    `- **Fecha:** ${report.finishedAt}`,
    `- **Repositorio:** \`${report.stack.repoPath}\``,
    `- **Rama Git:** \`${report.stack.gitBranch ?? 'N/A'}\``,
    `- **Stack detectado:** ${report.stack.detectedStacks.join(', ')} (principal: ${report.stack.primaryStack})`,
    `- **Duración total:** ${(report.totalDurationMs / 1000).toFixed(2)}s`,
    `- **Resumen:** ${report.summary.passed} aptas · ${report.summary.warned} observaciones · ${report.summary.failed} desfavorables · ${report.summary.skipped} omitidas`,
    '',
    '## Resultado por Estación',
    ''
  ];

  for (const station of report.stations) {
    lines.push(`### ${station.name} — [${statusBadge(station.status)}]`);
    lines.push(`- **Qué revisa:** ${station.didacticExplanation}`);
    lines.push(`- **Comando:** \`${station.command}\``);
    lines.push(`- **Resumen:** ${station.summary}`);
    lines.push(`- **Tiempo:** ${station.durationMs} ms`);
    if (station.findings.length > 0) {
      lines.push('- **Hallazgos:**');
      for (const finding of station.findings) {
        const loc = finding.file
          ? ` (\`${finding.file}${finding.line ? `:${finding.line}` : ''}\`)`
          : '';
        lines.push(`  - **[${finding.severity.toUpperCase()}] ${finding.title}**${loc}: ${finding.reason}`);
        lines.push(`    - *Cómo arreglarlo:* ${finding.howToFix}`);
      }
    }
    lines.push('');
  }

  if (report.securityChecklist) {
    const cl = report.securityChecklist;
    lines.push('## Checklist de Tranquilidad / Diligencia Debida en Seguridad');
    lines.push('');
    lines.push(`> ${cl.disclaimer}`);
    lines.push('');
    lines.push(
      `**Controles automáticos superados:** ${cl.automatedPassed}/${cl.automatedTotal} (${cl.scorePercent}%)`
    );
    lines.push('');
    lines.push('| Estado | Tipo | Control | Referencia | Detalle |');
    lines.push('|---|---|---|---|---|');
    for (const item of cl.items) {
      const tipo = item.category === 'automated' ? 'Automático' : 'Operativo/Legal';
      lines.push(
        `| ${item.status.toUpperCase()} | ${tipo} | ${item.title} | ${item.standardRef} | ${item.detail.replace(/\|/g, '\\|')} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}
