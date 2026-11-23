import { spawn } from 'node:child_process';
import type { CommandExecutor, CommandResult, CommandRunOptions } from '../../domain/types.js';

const MAX_OUTPUT_BYTES = 128 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
const ANSI_ESCAPE_REGEX =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g;

export function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEX, '');
}

function formatCommand(binary: string, args: readonly string[]): string {
  const escapedArgs = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg));
  return [binary, ...escapedArgs].join(' ');
}

export class SafeCommandExecutor implements CommandExecutor {
  async run(
    binary: string,
    args: readonly string[],
    options: CommandRunOptions
  ): Promise<CommandResult> {
    const startedAt = Date.now();
    const command = formatCommand(binary, args);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (options.signal?.aborted) {
      return {
        command,
        exitCode: null,
        stdout: '',
        stderr: 'Ejecución cancelada por señal de aborto.',
        durationMs: 0,
        timedOut: false,
        notFound: false
      };
    }

    return await new Promise<CommandResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let notFound = false;
      let settled = false;

      const child = spawn(binary, [...args], {
        cwd: options.cwd,
        shell: false,
        env: {
          ...process.env,
          ...(options.env ?? {}),
          CI: 'true',
          FORCE_COLOR: '0'
        }
      });

      const finish = (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
        resolve({
          command,
          exitCode,
          stdout: stripAnsi(stdout).trim(),
          stderr: stripAnsi(stderr).trim(),
          durationMs: Date.now() - startedAt,
          timedOut,
          notFound
        });
      };

      const killProcess = () => {
        try {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!settled) {
              child.kill('SIGKILL');
            }
          }, 1500).unref();
        } catch {
          // El proceso ya pudo haber finalizado.
        }
      };

      const timer = setTimeout(() => {
        timedOut = true;
        stderr += `\n[ITV] Timeout alcanzado tras ${timeoutMs} ms.`;
        killProcess();
      }, timeoutMs);
      timer.unref();

      const onAbort = () => {
        stderr += '\n[ITV] Comando cancelado por el usuario.';
        killProcess();
      };
      options.signal?.addEventListener('abort', onAbort, { once: true });

      child.stdout?.on('data', (chunk: Buffer) => {
        if (stdout.length < MAX_OUTPUT_BYTES) {
          stdout += chunk.toString('utf8').slice(0, MAX_OUTPUT_BYTES - stdout.length);
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        if (stderr.length < MAX_OUTPUT_BYTES) {
          stderr += chunk.toString('utf8').slice(0, MAX_OUTPUT_BYTES - stderr.length);
        }
      });

      child.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          notFound = true;
          stderr = `Binario no encontrado en el PATH: ${binary}`;
        } else {
          stderr = error.message;
        }
        finish(null);
      });

      child.on('close', (code) => {
        finish(code);
      });
    });
  }
}
