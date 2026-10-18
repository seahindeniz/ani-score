import clsx from 'clsx';
import type { Component } from 'solid-js';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  on,
  Show,
  Switch,
} from 'solid-js';
import LucideEye from '~icons/lucide/eye';
import LucideFlame from '~icons/lucide/flame';
import MdiHeart from '~icons/mdi/heart';
import MdiHeartMinus from '~icons/mdi/heart-minus';
import MdiHeartPlusOutline from '~icons/mdi/heart-plus-outline';
import StreamlineFreehandServerError404NotFound from '~icons/streamline-freehand/server-error-404-not-found';
import SvgSpinners3DotsMove from '~icons/svg-spinners/3-dots-move';

import type { fetchDetails } from '~/background/logic/fetchDetails';
import type { EpisodeCard } from '~/contentScripts/sites/types';
import { toColorEntries, useSettingsStore } from '~/logic';
import { isTrending } from '~/utils/isTrending';

import { AnimeInfoCard } from './AnimeInfo';
import { Chip } from './Chip';

import styles from './CardDetail.module.scss';
import '~/styles';

// Opening the details brings them up to date, but hovering one card after another doesn't ask AniList each time
const detailsMaxAge = 60 * 1000;

interface Props {
  card: EpisodeCard;
  store: { anime: NonNullable<Awaited<ReturnType<typeof fetchDetails>>> };
  /**
   * Asks AniList for the card's details again when what the extension keeps is older than `maxAge` milliseconds (0, or
   * left out, asks right away).
   */
  onRefresh?: (maxAge?: number) => void;
}

export const CardDetail: Component<Props> = (props) => {
  let containerRef!: HTMLDivElement;
  const settingsStore = useSettingsStore();
  const [isMakingFavorite, setMakingFavorite] = createSignal<boolean>(false);
  const [isFavorite, setFavorite] = createSignal<boolean>(false);
  const [softFavoriteAdditionCount, setSoftFavoriteAdditionCount] =
    createSignal(0);
  const details = createMemo(() => props.store.anime[props.card.title]!);
  const tags = createMemo(() =>
    toColorEntries(settingsStore.data().tagColor).reduce(
      (acc, entry) => {
        if (entry.name && entry.color) {
          acc[entry.name] = entry.color;
        }
        return acc;
      },
      {} as Record<string, string>,
    ),
  );
  const [heartHovered, setHeartHovered] = createSignal(false);
  const genreSettings = createMemo(() =>
    toColorEntries(settingsStore.data().genreColor).reduce(
      (acc, entry) => {
        if (entry.name && entry.color) {
          acc[entry.name] = entry.color;
        }
        return acc;
      },
      {} as Record<string, string>,
    ),
  );

  const handleFavoriteClick = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const id = details()?.id;

    if (isMakingFavorite() || id == null) {
      return;
    }

    try {
      setMakingFavorite(true);

      const { error } = await window.messageGateway.sendMessage(
        'make-anime-favorite',
        id as number,
      );

      if (!error) {
        setFavorite(!isFavorite());
        setSoftFavoriteAdditionCount((count) =>
          isFavorite() ? count + 1 : count - 1,
        );
        // AniList's count comes back with the change, replacing the one counted here
        props.onRefresh?.();
      }
    } finally {
      setMakingFavorite(false);
    }
  };

  createEffect(
    on(details, (anime) => {
      if (!anime) return;

      setFavorite(Boolean(anime?.isFavourite));
      setSoftFavoriteAdditionCount(0);
    }),
  );

  createEffect(
    on(details, (anime) => {
      const isWatching = Boolean(anime?.mediaListEntry);

      props.card.shimmeringElement?.classList.toggle(
        'ani-score-watching',
        isWatching,
      );
    }),
  );

  return (
    <div
      ref={containerRef}
      // Lets site styles reach this element through the shadow root with `.ani-score::part(container)`
      part="container"
      class={styles.container}
      classList={{
        'items-center': details() == null,
      }}
    >
      <Switch fallback={<SvgSpinners3DotsMove />}>
        <Match when={details() === null}>
          <div class="flex items-center gap-1">
            <StreamlineFreehandServerError404NotFound class="size-[16px]" />
            Not Found
          </div>
        </Match>
        <Match when={details()}>
          <div
            class={clsx(styles.row, styles.stats)}
            onMouseEnter={() => setHeartHovered(true)}
            onMouseLeave={() => setHeartHovered(false)}
          >
            <Show when={details()?.favourites != null}>
              <Chip
                emoji={
                  isFavorite() ? (
                    heartHovered() ? (
                      <MdiHeartMinus class="text-red-500" />
                    ) : (
                      <MdiHeart class="text-red-500" />
                    )
                  ) : (
                    <MdiHeartPlusOutline class="text-red-500" />
                  )
                }
                class="text-foreground decoration-none hover:decoration-underline"
                loading={isMakingFavorite()}
                text={details()!.favourites! + softFavoriteAdditionCount()}
                title={isFavorite() ? 'Remove Favorite' : 'Add Favorite'}
                onClick={handleFavoriteClick}
              />
            </Show>
            <Show when={details()?.popularity}>
              <AnimeInfoCard
                anime={details()!}
                onOpen={() => props.onRefresh?.(detailsMaxAge)}
              />
            </Show>
            <Show when={details()?.mediaListEntry}>
              <Chip
                emoji={<LucideEye class={styles.icon} />}
                text={
                  <span>
                    {details()!.mediaListEntry?.progress}
                    <span class={styles.total} title="Episodes out">
                      /
                      {Math.max(
                        details()?.episodes || 0,
                        details()?.nextAiringEpisode?.episode || 0,
                      )}
                    </span>
                  </span>
                }
                title="Watching"
              />
            </Show>
            <Show when={details()?.startDate != null && isTrending(details()!)}>
              <Chip
                class={styles.trending}
                emoji={<LucideFlame />}
                text="Trending"
                title="Trending"
              />
            </Show>
          </div>
          <Show when={details()?.genres?.length}>
            <div class={clsx(styles.row, styles.genres)}>
              <For each={details()!.genres}>
                {(genre) => (
                  <span
                    class={styles.genre}
                    style={{ color: genreSettings()[genre!] }}
                  >
                    {genre}
                  </span>
                )}
              </For>
            </div>
          </Show>
          <Show when={details()?.tags?.length}>
            <div class={clsx(styles.row, styles.tags)}>
              <For
                each={details()!
                  .tags!.filter((item) => item != null)
                  .slice(0, 5)}
              >
                {({ name }) => (
                  <span style={{ color: tags()[name.toLowerCase()] }}>
                    {name}
                  </span>
                )}
              </For>
            </div>
          </Show>
        </Match>
      </Switch>
    </div>
  );
};
