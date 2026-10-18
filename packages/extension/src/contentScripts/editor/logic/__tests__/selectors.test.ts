import { describe, expect, it } from 'bun:test';

import {
  elementSelector,
  generalizeCardSelector,
  relativeSelector,
  stableClasses,
  suggestPathPattern,
} from '../selectors';

function element(html: string) {
  const template = document.createElement('template');

  template.innerHTML = html.trim();

  return template.content.firstElementChild as HTMLElement;
}

describe('stableClasses', () => {
  it('keeps the classes that name the element', () => {
    expect(
      stableClasses(element('<a class="anime-card hoverable"></a>')),
    ).toEqual(['.anime-card', '.hoverable']);
  });

  it('leaves out generated and utility classes', () => {
    expect(
      stableClasses(
        element(
          '<a class="svelte-swvl7y css-1x2y3z jsx-123 _3fX9a_k flex p-2 md:grid w-1/2 text-sm episode-card"></a>',
        ),
      ),
    ).toEqual(['.episode-card']);
  });

  it("keeps a CSS module class's stable part", () => {
    expect(
      stableClasses(element('<a class="home_recent-card__WB7YR"></a>')),
    ).toEqual(['[class*="home_recent-card__"]']);
    expect(
      stableClasses(element('<a class="home_recent-card__a1b2c"></a>')),
    ).toEqual(['[class*="home_recent-card__"]']);
    // A BEM element of five letters is a name, not a hash
    expect(stableClasses(element('<a class="anime-card__title"></a>'))).toEqual(
      ['.anime-card__title'],
    );
  });

  it('escapes what a selector would misread', () => {
    expect(stableClasses(element('<a class="card#1"></a>'))).toEqual([
      '.card\\#1',
    ]);
  });
});

describe('elementSelector', () => {
  it('uses a stable id', () => {
    expect(
      elementSelector(element('<section id="new-episodes"></section>')),
    ).toBe('#new-episodes');
  });

  it('uses the tag and up to two classes otherwise', () => {
    expect(
      elementSelector(element('<div id="ember1234" class="a b c"></div>')),
    ).toBe('div.a.b');
    expect(elementSelector(element('<div id="x-9f3a2b1c7d"></div>'))).toBe(
      'div',
    );
    expect(
      elementSelector(
        element('<episode-portrait-item></episode-portrait-item>'),
      ),
    ).toBe('episode-portrait-item');
  });
});

describe('generalizeCardSelector', () => {
  it('finds the card around a picked element, scoped to their container', () => {
    document.body.innerHTML = `
      <div class="list">
        <article class="card"><h3 class="title">Frieren</h3><span class="tag">A</span><span class="tag">B</span></article>
        <article class="card"><h3 class="title">Dandadan</h3></article>
        <article class="card"><h3 class="title">One Piece</h3></article>
      </div>`;

    expect(generalizeCardSelector(document.querySelector('.tag')!)).toBe(
      'div.list > article.card',
    );
  });

  it('prefers the outer element when a wrapper repeats as often as the card', () => {
    document.body.innerHTML = `
      <div class="episodes">
        <div><a class="anime-card"><span>Frieren</span></a></div>
        <div><a class="anime-card"><span>Dandadan</span></a></div>
      </div>`;

    expect(generalizeCardSelector(document.querySelector('span')!)).toBe(
      'div.episodes > div',
    );
  });

  it('gives up when nothing around the element repeats', () => {
    document.body.innerHTML = '<main><p>Alone</p></main>';

    expect(
      generalizeCardSelector(document.querySelector('p')!),
    ).toBeUndefined();
  });
});

describe('relativeSelector', () => {
  const card = element(`
    <article>
      <div class="copy"><h3>Frieren</h3><span>5. Bölüm</span></div>
      <div class="meta"><span>2 saat önce</span></div>
    </article>`);

  it('is empty for the card itself', () => {
    expect(relativeSelector(card, card)).toBe('');
  });

  it('is as short as it can be', () => {
    expect(relativeSelector(card, card.querySelector('h3')!)).toBe('h3');
    expect(relativeSelector(card, card.querySelector('.meta span')!)).toBe(
      'div.meta > span',
    );
  });

  it('spells out positions when the path also leads to an earlier element', () => {
    const list = element('<ul><li><a></a></li><li><a></a></li></ul>');
    const target = list.querySelectorAll('a')[1];
    const selector = relativeSelector(list, target);

    expect(selector).toBe(':scope > li:nth-child(2) > a:nth-child(1)');
    expect(list.querySelector(selector)).toBe(target);
  });
});

describe('suggestPathPattern', () => {
  it('turns numbers into \\d+', () => {
    expect(suggestPathPattern('/')).toBe('^/$');
    expect(suggestPathPattern('/episodes/latest/1')).toBe(
      '^/episodes/latest/\\d+$',
    );
    expect(suggestPathPattern('/listeler/yenibolum/sayfa-12/')).toBe(
      '^/listeler/yenibolum/sayfa-\\d+/$',
    );
    expect(suggestPathPattern('/a.b+c')).toBe('^/a\\.b\\+c$');
  });
});
