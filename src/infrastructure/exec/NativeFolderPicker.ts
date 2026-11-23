import type { CommandExecutor } from '../../domain/types.js';

export async function pickNativeFolder(
  executor: CommandExecutor,
  platform: NodeJS.Platform = process.platform
): Promise<string | null> {
  if (platform === 'darwin') {
    const script =
      'POSIX path of (choose folder with prompt "Seleccioná la carpeta del repositorio para la ITV")';
    const res = await executor.run('osascript', ['-e', script], {
      cwd: process.cwd(),
      timeoutMs: 120_000
    });
    if (res.notFound) {
      throw new Error('osascript no disponible en este sistema.');
    }
    if (res.exitCode !== 0) {
      if (res.stderr.includes('-128') || /User canceled/i.test(res.stderr)) {
        return null;
      }
      throw new Error(res.stderr || 'No se pudo abrir el selector de carpetas en macOS.');
    }
    const selected = res.stdout.trim().replace(/\/+$/, '');
    return selected || null;
  }

  if (platform === 'win32') {
    const psScript = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
      '$dialog.Description = "Selecciona la carpeta del repositorio para la ITV"',
      '$dialog.UseDescriptionForTitle = $true',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }'
    ].join('; ');

    const res = await executor.run(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-STA', '-Command', psScript],
      {
        cwd: process.cwd(),
        timeoutMs: 120_000
      }
    );
    if (res.notFound) {
      throw new Error('PowerShell no encontrado en Windows. Pegá la ruta manualmente en el campo.');
    }
    if (res.exitCode !== 0) {
      throw new Error(res.stderr || 'No se pudo abrir el selector de carpetas en Windows.');
    }
    const selected = res.stdout.trim().replace(/[\\/]+$/, '');
    return selected || null;
  }

  // Linux: zenity o kdialog
  const zenity = await executor.run(
    'zenity',
    ['--file-selection', '--directory', '--title=Seleccionar carpeta del repositorio'],
    { cwd: process.cwd(), timeoutMs: 120_000 }
  );
  if (!zenity.notFound) {
    if (zenity.exitCode !== 0) return null;
    return zenity.stdout.trim().replace(/\/+$/, '') || null;
  }

  const kdialog = await executor.run(
    'kdialog',
    ['--getexistingdirectory', process.cwd()],
    { cwd: process.cwd(), timeoutMs: 120_000 }
  );
  if (!kdialog.notFound) {
    if (kdialog.exitCode !== 0) return null;
    return kdialog.stdout.trim().replace(/\/+$/, '') || null;
  }

  throw new Error('No se encontró zenity ni kdialog en Linux. Pegá la ruta manualmente en el campo.');
}
