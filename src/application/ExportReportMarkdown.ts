import { getCoreLabels, getLocalizedStationName, type SupportedLang } from '../domain/i18n.js';
import type { InspectionReport } from '../domain/types.js';

export function exportReportAsMarkdown(
  report: InspectionReport,
  lang: SupportedLang = 'es'
): string {
  const t = getCoreLabels(lang);
  const lines: string[] = [
    `# ${t.reportTitle} — ${report.stack.repoName}`,
    '',
    `- **${t.verdict}:** ${t.verdicts[report.verdict]} (${report.blocksPush ? t.blocksPush : t.readyToPush})`,
    `- **${t.date}:** ${report.finishedAt}`,
    `- **${t.repository}:** \`${report.stack.repoPath}\``,
    `- **${t.gitBranch}:** \`${report.stack.gitBranch ?? 'N/A'}\``,
    `- **${t.detectedStack}:** ${report.stack.detectedStacks.join(', ')} (${t.primary}: ${report.stack.primaryStack})`,
    `- **${t.totalDuration}:** ${(report.totalDurationMs / 1000).toFixed(2)}s`,
    `- **${t.summary}:** ${t.summaryCounts(report.summary.passed, report.summary.warned, report.summary.failed, report.summary.skipped)}`,
    ...(report.scope
      ? [
          `- **${t.diagnosticScope}:** ${report.scope.label} (${report.scope.evaluatedStations}/${report.scope.totalStations} ${t.verified} · ${report.scope.confidencePercent}%) — ${report.scope.note}`
        ]
      : []),
    '',
    `## ${t.resultsByStation}`,
    ''
  ];

  for (const station of report.stations) {
    const stationTitle = getLocalizedStationName(station.id, station.name, lang);
    lines.push(`### ${stationTitle} — [${t.statusBadges[station.status]}]`);
    lines.push(`- **${t.whatItChecks}:** ${station.didacticExplanation}`);
    lines.push(`- **${t.command}:** \`${station.command}\``);
    lines.push(`- **${t.summary}:** ${station.summary}`);
    lines.push(`- **${t.time}:** ${station.durationMs} ms`);
    if (station.externalLinks && station.externalLinks.length > 0) {
      lines.push(`- **${t.externalPanels}:**`);
      for (const link of station.externalLinks) {
        lines.push(`  - [${link.label}](${link.url}) — *${link.status}*: ${link.summary}`);
      }
    }
    if (station.findings.length > 0) {
      lines.push(`- **${t.findings}:**`);
      for (const finding of station.findings) {
        const loc = finding.file
          ? ` (\`${finding.file}${finding.line ? `:${finding.line}` : ''}\`)`
          : '';
        lines.push(`  - **[${finding.severity.toUpperCase()}] ${finding.title}**${loc}: ${finding.reason}`);
        lines.push(`    - *${t.howToFix}:* ${finding.howToFix}`);
      }
    }
    lines.push('');
  }

  if (report.securityChecklist) {
    const cl = report.securityChecklist;
    lines.push(`## ${t.checklistTitle}`);
    lines.push('');
    lines.push(`> ${cl.disclaimer}`);
    lines.push('');
    lines.push(
      `**${t.automatedPassed}:** ${cl.automatedPassed}/${cl.automatedTotal} (${cl.scorePercent}%)`
    );
    lines.push('');
    lines.push(t.checklistTableHeader);
    lines.push('|---|---|---|---|---|');
    for (const item of cl.items) {
      const tipo = item.category === 'automated' ? t.automated : t.operational;
      lines.push(
        `| ${item.status.toUpperCase()} | ${tipo} | ${item.title} | ${item.standardRef} | ${item.detail.replace(/\|/g, '\\|')} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}
