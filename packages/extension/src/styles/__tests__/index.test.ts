import { describe, expect, it } from 'bun:test';

describe('styles', () => {
  it('loads the reset, base and UnoCSS stylesheets without exports', async () => {
    expect(Object.keys(await import('../index'))).toEqual([]);
  });
});
