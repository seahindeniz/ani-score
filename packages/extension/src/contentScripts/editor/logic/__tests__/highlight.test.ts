import { describe, expect, it } from 'bun:test';

import { createHighlight } from '../highlight';

describe('createHighlight', () => {
  it('outlines the hovered element and the matches of valid selectors', () => {
    const highlight = createHighlight();
    const style = document.head.querySelector('style')!;

    highlight.show(['.card', '', 'div[']);

    expect(style.textContent).toContain('[data-ani-score-hover] {');
    expect(style.textContent).toContain(':is(.card) {');
    expect(style.textContent).not.toContain('div[');

    highlight.dispose();

    expect(style.isConnected).toBe(false);
  });
});
