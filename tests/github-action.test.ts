import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('GitHub Action oficial (action.yml — #2)', () => {
  it('define inputs, outputs, comentario sticky y gate estricto sin falsos verdes', async () => {
    const raw = await readFile(path.resolve(process.cwd(), 'action.yml'), 'utf8');

    expect(raw).toContain("using: 'composite'");
    expect(raw).toContain('min-coverage:');
    expect(raw).toContain('post-pr-comment:');
    expect(raw).toContain('fail-on-warn:');
    expect(raw).toContain('lang:');
    expect(raw).toContain('<!-- itv-calidad-pr-comment -->');
    expect(raw).toContain('GITHUB_STEP_SUMMARY');
    expect(raw).toContain('Enforce ITV Quality Gate');
    expect(raw).toContain('exit "$ITV_EXIT_CODE"');
  });
});
