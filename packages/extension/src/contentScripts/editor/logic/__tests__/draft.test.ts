import { describe, expect, it } from 'bun:test';

import { idFromHost, newDraft } from '../draft';

describe('idFromHost', () => {
  it("is the site's name without www and the top-level domain", () => {
    expect(idFromHost('www.animex.club')).toBe('animex');
    expect(idFromHost('openani.me')).toBe('openani');
    expect(idFromHost('tr.anime.example.com')).toBe('tr-anime-example');
    expect(idFromHost('localhost')).toBe('localhost');
    expect(idFromHost('Anime_Site.tv')).toBe('anime-site');
  });
});

describe('newDraft', () => {
  it('starts with the current page and one card type to fill in', () => {
    expect(
      newDraft({ hostname: 'www.animex.club', pathname: '/episodes/2' }),
    ).toEqual({
      schemaVersion: 1,
      id: 'animex',
      name: 'Animex',
      matches: ['*://www.animex.club/*'],
      pages: [
        {
          match: { path: '^/episodes/\\d+$' },
          cards: [{ selector: '', title: {}, inject: { position: 'append' } }],
        },
      ],
    });
  });

  it('names a site whose name makes no id after its host', () => {
    expect(newDraft({ hostname: '123.45', pathname: '/' }).name).toBe('123');
    expect(newDraft({ hostname: '--.tv', pathname: '/' }).name).toBe('--.tv');
  });
});
