import { describe, expect, it } from 'bun:test';

describe('options entry', () => {
  it('renders the options page into #app', async () => {
    const root = document.createElement('div');

    root.id = 'app';
    document.body.append(root);

    await import('../main');

    expect(root.querySelector('img')?.getAttribute('alt')).toBe(
      'extension icon',
    );
  });
});
