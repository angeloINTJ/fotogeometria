/**
 * The reference algorithm is the validated script, byte for byte.
 *
 * reference/corrigir_geometria.py is the Python that PLANO.md §3 calls
 * validated, copied on 2026-11-25. The parity fixtures are generated from it,
 * so an edit here silently moves what "correct" means. A deliberate change
 * updates this hash in the same commit, and says why.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('reference/corrigir_geometria.py is the validated script', () => {
  const bytes = readFileSync(join(import.meta.dirname, '../reference/corrigir_geometria.py'));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(
    '754e515458c90e8bbec96cf062705782d153d796b22768ffbd92a0bb6c1cffe6',
  );
});
