import { describe, expect, it } from 'bun:test';

import { createHighlight, glowAttribute, markAttribute } from '../highlight';

describe('createHighlight', () => {
  it('marks the given elements, replacing the previous marks', () => {
    document.body.innerHTML =
      '<div class="card"><h3>Frieren</h3><img></div><div class="card"></div>';

    const [card, other] = document.querySelectorAll('.card');
    const title = card.querySelector('h3')!;
    const poster = card.querySelector('img')!;
    const highlight = createHighlight();
    const style = document.head.querySelector('style')!;

    expect(style.textContent).toContain('[data-ani-score-hover] {');

    highlight.show({
      card: [card],
      part: [title],
      skipped: [other],
      glow: [poster],
    });

    expect(card.getAttribute(markAttribute)).toBe('card');
    expect(title.getAttribute(markAttribute)).toBe('part');
    expect(other.getAttribute(markAttribute)).toBe('skipped');
    expect(poster.hasAttribute(glowAttribute)).toBe(true);

    highlight.show({ card: [other] });

    expect(card.hasAttribute(markAttribute)).toBe(false);
    expect(title.hasAttribute(markAttribute)).toBe(false);
    expect(poster.hasAttribute(glowAttribute)).toBe(false);
    expect(other.getAttribute(markAttribute)).toBe('card');

    highlight.dispose();

    expect(other.hasAttribute(markAttribute)).toBe(false);
    expect(style.isConnected).toBe(false);
  });
});
