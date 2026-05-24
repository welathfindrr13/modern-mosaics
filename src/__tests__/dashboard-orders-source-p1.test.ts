import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('dashboard orders source of truth', () => {
  it('uses the canonical orders API instead of localStorage', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/dashboard/orders/page.tsx'), 'utf8');

    expect(source).toContain("fetch('/api/orders/list'");
    expect(source).not.toContain('modernMosaicsOrders');
    expect(source).not.toContain('localStorage');
  });
});
