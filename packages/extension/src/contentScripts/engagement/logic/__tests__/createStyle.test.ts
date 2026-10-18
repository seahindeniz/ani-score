import { describe, expect, it } from 'bun:test';

import { createStyle, ownElementAttribute } from '../createStyle';

describe('createStyle', () => {
  it("creates a style element marked as AniScore's own", () => {
    const style = createStyle('.card { gap: 8px }');

    expect(style.textContent).toBe('.card { gap: 8px }');
    expect(style.hasAttribute(ownElementAttribute)).toBe(true);
  });
});
