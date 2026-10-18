import { afterEach, describe, expect, it } from 'bun:test';

import sites from 'virtual:ani-score/sites';

import { collectCards, pageMatches } from '~/contentScripts/sites/extract';

/**
 * The sites added from the editor research, read from trimmed copies of their real markup. They're optional: users
 * turn them on from the side panel.
 */
const cases: {
  id: string;
  path: string;
  html: string;
  cards: { title: string; episodeNumber: number }[];
}[] = [
  {
    id: 'animex',
    path: '/',
    html: `
      <section id="son-bolumler"><div class="episode-grid">
        <a class="episode-card group flex gap-3 rounded-xl p-2.5" href="/izle/dungeon-ni-deai-3-sezon-oqj/4">
          <div class="relative w-16 h-22 shrink-0"><img alt="Dungeon ni Deai" loading="lazy"></div>
          <div class="min-w-0 flex-1 py-0.5">
            <h3 class="text-sm font-semibold">Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka 3. Sezon</h3>
            <p class="mt-1 text-xs font-bold text-gradient inline-block">4<!-- -->. Bölüm</p>
            <p class="mt-1 text-xs text-muted truncate">618<!-- --> izlenme</p>
          </div>
        </a>
      </div></section>`,
    cards: [
      {
        title:
          'Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka Season 3',
        episodeNumber: 4,
      },
    ],
  },
  {
    id: 'animexe',
    path: '/',
    html: `
      <div class="sl-scroll">
        <a href="/watch/the-garden-of-sinners-the-hollow-shrine-15007/1/1" class="sl-card">
          <div class="sl-thumb"><img src="7647.webp" alt=""><span class="sl-ep-badge">S01E01</span></div>
          <div class="sl-body">
            <div class="sl-anime-name">The Garden of Sinners: The Hollow Shrine</div>
            <div class="sl-title">1. Bölüm</div>
          </div>
        </a>
        <a href="/watch/demon-slayer/2/7" class="sl-card">
          <div class="sl-thumb"><span class="sl-ep-badge">S02E07</span></div>
          <div class="sl-body"><div class="sl-anime-name">Demon Slayer</div><div class="sl-title">7. Bölüm</div></div>
        </a>
      </div>`,
    cards: [
      { title: 'The Garden of Sinners: The Hollow Shrine', episodeNumber: 1 },
      { title: 'Demon Slayer Season 2', episodeNumber: 7 },
    ],
  },
  {
    id: 'acheriya',
    path: '/',
    html: `
      <div class="grid grid-cols-2 gap-4">
        <div class="group" style="opacity:0"><div class="relative">
          <a class="group block rounded-xl" href="/izle/ao-ashi-s2/bolum-3">
            <div class="relative aspect-[3/4] overflow-hidden rounded-xl"><img alt="Ao Ashi S2"></div>
            <div class="mt-3 space-y-1"><h3 class="line-clamp-2 text-sm">Ao Ashi S2</h3>
              <p class="flex text-xs"><span>Bölüm 3</span></p></div>
          </a>
        </div></div>
        <div class="group"><div class="relative">
          <a class="group block rounded-xl" href="/izle/one-piece">
            <div class="relative"></div><div class="mt-3"><h3>One Piece</h3><p><span>1200 Bölüm</span></p></div>
          </a>
        </div></div>
      </div>`,
    cards: [{ title: 'Ao Ashi Season 2', episodeNumber: 3 }],
  },
  {
    id: 'acheriya',
    path: '/yeni-eklenenler',
    html: `
      <div class="space-y-4">
        <div class="bg-card border rounded-lg">
          <h3 class="text-lg">Ace of Diamond Act II S2</h3>
          <p class="text-muted-foreground">Bölüm 4</p>
          <a href="/izle/ace-of-diamond-act-ii-s2/bolum-4">İzle</a>
          <a href="/izle/ace-of-diamond-act-ii-s2">Detaylar</a>
        </div>
      </div>`,
    cards: [{ title: 'Ace of Diamond Act II Season 2', episodeNumber: 4 }],
  },
  {
    id: 'asyaanimeleri',
    path: '/page/2/',
    html: `
      <div class="listupd normal"><div class="excstf">
        <article class="bs"><div class="bsx">
          <a href="/seytan-avcisi-3-sezon-30-bolum/" title="Şeytan Avcısı 3.Sezon 30.Bölüm" class="tip">
            <div class="limit"><div class="bt"><span class="epx">Blm 99</span></div><img class="ts-post-image"></div>
            <div class="ttt"><div class="tt">Şeytan Avcısı <h2 itemprop="headline">Şeytan Avcısı 3.Sezon 30.Bölüm</h2></div>
              <div class="timeago">2 saat önce</div></div>
          </a>
        </div></article>
        <article class="bs"><div class="bsx"><a class="tip">
          <div class="limit"></div><div class="ttt"><div class="tt">Xian Ni <h2>Xian Ni</h2></div></div>
        </a></div></article>
      </div></div>
      <div class="owl-item cloned"><div class="listupd normal"><article class="bs"><div class="bsx"><a class="tip">
        <div class="ttt"><div class="tt"><h2>Clone 1.Bölüm</h2></div><div class="timeago"></div></div>
      </a></div></article></div></div>`,
    cards: [{ title: 'Şeytan Avcısı Season 3', episodeNumber: 30 }],
  },
  {
    id: 'animpow',
    path: '/',
    html: `
      <section class="section" id="new-episodes"><div class="home_recent-strip__i6wZn">
        <a class="home_recent-card__WB7YR" href="/watch/9072-2B73993D27ED/s1e4?source=c3aee778">
          <div class="home_recent-thumb__0ogNr"><img alt="Magical Explorer"><span class="home_recent-ep-badge__qTe6p">S1-E4</span></div>
          <div class="home_recent-info__lrGUX"><div class="home_recent-title__haGL4" title="Magical Explorer">Magical Explorer</div></div>
        </a>
        <a class="home_recent-card__WB7YR" href="/watch/1/s3e8">
          <div class="home_recent-thumb__0ogNr"><span class="home_recent-ep-badge__qTe6p">S3-E8</span></div>
          <div class="home_recent-info__lrGUX"><div class="home_recent-title__haGL4">Mushoku Tensei: Jobless Reincarnation</div></div>
        </a>
      </div></section>`,
    cards: [
      { title: 'Magical Explorer', episodeNumber: 4 },
      {
        title: 'Mushoku Tensei: Jobless Reincarnation Season 3',
        episodeNumber: 8,
      },
    ],
  },
  {
    id: 'openani',
    path: '/episodes/latest/1',
    html: `
      <div class="episodes"><section><div class="no-select">
        <div><a class="anime-card fds-theme-dark no-select svelte-swvl7y hoverable" href="/anime/magicalexplorer/1/4">
          <img id="main" alt="Cover Art of Magical Explorer 1. Sezon 4. Bölüm">
          <div id="content"><span class="text-block type-body-strong anime-name">Magical Explorer 1. Sezon 4. Bölüm</span></div>
        </a></div>
        <div><a class="anime-card svelte-swvl7y" href="/anime/blue-box/2/3">
          <div id="content"><span class="anime-name">
            Blue Box

            2. Sezon, 3. Bölüm</span></div>
        </a></div>
      </div></section></div>
      <div id="content" class="grid">
        <a class="anime-card svelte-swvl7y" href="/anime/one-piece"><h5 class="anime-name">One Piece</h5></a>
        <a class="anime-card svelte-swvl7y" href="/anime/tokyo-revengers"><h5 class="anime-name">Tokyo Revengers</h5></a>
      </div>`,
    cards: [
      { title: 'Magical Explorer', episodeNumber: 4 },
      { title: 'Blue Box Season 2', episodeNumber: 3 },
    ],
  },
  {
    id: 'animecix',
    path: '/',
    html: `
      <media-view class="full-width portrait-mode"><div class="auto-height-grid">
        <episode-portrait-item><div class="grid-item"><div class="grid-content">
          <media-image mode="portrait"><a href="/titles/9894/ao-ashi/season/2/episode/3"><img class="media-image-el"></a></media-image>
        </div></div>
        <div class="grid-label"><a class="title" href="/titles/9894/ao-ashi">Ao Ashi</a><div class="subtitle"> 2. Sezon 3. Bolum </div></div>
        </episode-portrait-item>
        <episode-portrait-item><div class="grid-item"><media-image></media-image></div>
        <div class="grid-label"><a class="title">Seitokai ni mo Ana wa Aru!</a><div class="subtitle"> 3. Bolum </div></div>
        </episode-portrait-item>
      </div></media-view>`,
    cards: [
      { title: 'Ao Ashi Season 2', episodeNumber: 3 },
      { title: 'Seitokai ni mo Ana wa Aru!', episodeNumber: 3 },
    ],
  },
  {
    id: 'sonanime',
    path: '/',
    html: `
      <div class="row anime-columns">
        <div class="anime-card-wrapper"><div class="square-box is-loaded">
          <a class="w-100 h-100" href="/anime/blue-box/season/2/episode/3"><span class="square-box-image-wrapper"><img alt="Blue Box"></span></a>
          <div class="image-details"><h3>Blue Box</h3><p>Sezon 2</p><p>Bölüm 3</p></div>
        </div></div>
        <div class="anime-card-wrapper"><div class="square-box is-loaded">
          <a href="/anime/one-piece"></a><div class="image-details"><h3>One Piece</h3></div>
        </div></div>
      </div>`,
    cards: [{ title: 'Blue Box Season 2', episodeNumber: 3 }],
  },
];

afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('community sites', () => {
  it('are optional, and their cards are read as on the live site', () => {
    for (const { id, path, html, cards } of cases) {
      const site = sites.find((item) => item.id === id)!;

      history.replaceState(null, '', path);
      document.body.innerHTML = html;

      const pages = site.pages.filter((page) => pageMatches(page, location));

      expect(site.access).toBeUndefined();
      expect(pages.length).toBeGreaterThan(0);
      expect(
        collectCards(pages).map(({ title, episodeNumber }) => ({
          title,
          episodeNumber,
        })),
      ).toEqual(cards);

      // Every card has a place for the details
      for (const card of collectCards(pages)) {
        const container = document.createElement('div');

        card.render(container);
        expect(card.element.contains(container) || container.isConnected).toBe(
          true,
        );
      }
    }
  });
});
