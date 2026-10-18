import { describe, expect, it } from 'bun:test';

import { wait } from '../wait';

describe('wait', () => {
  it('resolves after the given delay', async () => {
    const start = performance.now();

    await wait(30);

    expect(performance.now() - start).toBeGreaterThanOrEqual(25);
  });

  it('defaults to the next macrotask', async () => {
    let ranTimeout = false;

    setTimeout(() => {
      ranTimeout = true;
    });
    await wait();

    expect(ranTimeout).toBe(true);
  });
});
