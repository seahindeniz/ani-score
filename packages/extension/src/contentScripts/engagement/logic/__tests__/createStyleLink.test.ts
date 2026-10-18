import { describe, expect, it } from 'bun:test';

import { createStyleLink } from '../createStyleLink';

describe('createStyleLink', () => {
  it("links the scope's stylesheet from the extension", () => {
    const link = createStyleLink('engagement');

    expect(link.rel).toBe('stylesheet');
    expect(link.getAttribute('href')).toBe(
      'chrome-extension://test-extension-id/dist/contentScripts/engagement/style.css',
    );
  });
});
