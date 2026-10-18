import { describe, expect, it } from 'bun:test';

describe('widget content script', () => {
  it('mounts the widget with its styles in a shadow root', async () => {
    // The script mounts itself on import
    await import('../main');

    const shadowRoot = document.body.querySelector('.ani-score')!.shadowRoot!;

    expect(shadowRoot.querySelector('link')!.getAttribute('href')).toBe(
      'chrome-extension://test-extension-id/dist/contentScripts/widget/style.css',
    );
    expect(shadowRoot.querySelector('button')!.textContent).toBe('⚡');
  });
});
