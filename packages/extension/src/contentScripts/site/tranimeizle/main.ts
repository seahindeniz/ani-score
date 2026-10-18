import type { SiteBaseConfig } from '../base';
import './global.scss';

export const config: SiteBaseConfig = {
  theme: (set) => {
    const sync = () =>
      set(
        window.localStorage.getItem('temabuton') === 'dark' ? 'dark' : 'light',
      );

    sync();
    // The site's theme toggle swaps `dark-mode` / `light-mode` on the body, right before saving the choice to storage
    new MutationObserver(sync).observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
  },
  listingPages: [
    {
      isValidPage: () =>
        window.location.pathname === '/'
        || /^\/listeler\/yenibolum\/sayfa-\d+\/?$/.test(
          window.location.pathname,
        ),
      episodeCards: () => {
        const elements = document.querySelectorAll<HTMLElement>(
          '.flex-wrap-layout > .flx-block',
        );

        return Array.from(elements).map((element) => {
          // The bar is absolutely positioned over the poster, so inserting before it places the details below the poster
          const infoContainer = element.querySelector<HTMLDivElement>('.bar');

          if (!infoContainer) return undefined;

          // e.g. "The Apothecary Diaries 3. Sezon 3. Bölüm İzle"
          const text =
            infoContainer.querySelector('h4')?.textContent.trim() ?? '';
          // Tolerates other whitespace and words between "Bölüm" and "İzle" (e.g. "Final"), and half episodes like "12.5"
          const episodeMatch = text.match(
            /(\d+(?:[.,]\d+)?)\.\s*Bölüm\s.*İzle$/,
          );

          if (!episodeMatch) return undefined;

          // The database's titles and synonyms use "Season 3" / "Part 2" instead of the Turkish markers
          const title = text
            .slice(0, episodeMatch.index)
            .trim()
            .replace(/(\d+)\.\s*Sezon/g, 'Season $1')
            .replace(/(\d+)\.\s*Kısım/g, 'Part $1');
          const episodeNumber = Number.parseInt(episodeMatch[1]);

          if (!title) return undefined;

          return {
            element,
            render: (container) => infoContainer.before(container),
            title,
            episodeNumber,
          };
        });
      },
      getShimmeringElement: (card) =>
        card.element.querySelector<HTMLAnchorElement>('a.news-image'),
    },
  ],
};
