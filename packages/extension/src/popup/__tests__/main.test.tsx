import { describe, expect, it } from 'bun:test';

describe('popup entry', () => {
  it('renders the popup into #app', async () => {
    const root = document.createElement('div');

    root.id = 'app';
    document.body.append(root);

    await import('../main');

    expect(root.querySelector('button')?.textContent).toContain('Open Options');
  });
});
