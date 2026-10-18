import type { Component } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import LucideUsers from '~icons/lucide/users';

import type { ComponentRef } from '~/@types/utilities';
import type { AnimeDetails } from '~/background/logic/fetchDetails';
import { Popover } from '~/components/Popover';
import { Card } from '~/components/ui/card';

import { useRefStore } from '../../store/refStore';
import { Chip } from './Chip';

import styles from './CardDetail.module.scss';

// 13,220 as 13.2K: the full number is a click away, on AniList and in the details
const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

interface AnimeInfoCardProps {
  anime: AnimeDetails;
  /**
   * When the details open, so they can be brought up to date.
   */
  onOpen?: () => void;
}

function cleanDescription(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<i>/gi, '')
    .replace(/<\/i>/gi, '')
    .replace(/\n/g, ' ')
    .trim();
}

function truncateText(text: string, maxLength: number = 180) {
  const cleaned = cleanDescription(text);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trim()}...`;
}

// RELEASING as Releasing, SIDE_STORY as Side story
function titleCase(value: string) {
  const words = value.toLowerCase().replace(/_/g, ' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Formats AniList spells as acronyms stay that way; TV_SHORT as TV short
function formatName(format: string) {
  return /^(TV|ONA|OVA)$/.test(format)
    ? format
    : titleCase(format).replace(/^Tv/, 'TV');
}

const hasNode = <Edge extends { node?: unknown }>(
  edge: Edge | null | undefined,
): edge is Edge & { node: NonNullable<Edge['node']> } => Boolean(edge?.node);

const statusColors: Record<string, string> = {
  RELEASING: 'bg-emerald-500',
  NOT_YET_RELEASED: 'bg-amber-500',
  HIATUS: 'bg-amber-500',
  CANCELLED: 'bg-red-500',
};

const heading = 'm-0 text-[11.5px] font-semibold text-muted-foreground';

const firstName = (name: string | null | undefined) => name?.split(' ')[0];

// "Source (Novel)": how it relates, and what it is
function relationLabel(relation: {
  relationType?: string | null;
  node: { format?: string | null; type?: string | null };
}) {
  const kind = formatName(relation.node.format || relation.node.type || '');
  const type = titleCase(relation.relationType || '');

  if (!type || !kind) return type || kind;

  return `${type} (${kind})`;
}

export const AnimeInfoCard: Component<AnimeInfoCardProps> = (props) => {
  let popoverRef!: ComponentRef<typeof Popover>;
  const refStore = useRefStore();

  // Only the entries there's something to show for
  const characters = createMemo(() =>
    (props.anime.characterPreview?.edges ?? []).filter(hasNode),
  );
  const relations = createMemo(() =>
    (props.anime.relations?.edges ?? []).filter(hasNode),
  );
  const anilistUrl = () => `https://anilist.co/anime/${props.anime.id}`;

  const handleChange = (isOpen: boolean) => {
    if (isOpen) props.onOpen?.();

    if (isOpen && popoverRef !== refStore.activeAnimeInfoPopoverRef) {
      refStore.activeAnimeInfoPopoverRef?.close();

      refStore.activeAnimeInfoPopoverRef = popoverRef;
    }

    if (!isOpen && refStore.activeAnimeInfoPopoverRef === popoverRef) {
      refStore.activeAnimeInfoPopoverRef = null;
    }
  };

  return (
    <Popover
      ref={popoverRef}
      portTo={refStore.portalRoot?.root}
      closeMode="click"
      closeDelay={200}
      onChange={handleChange}
      trigger={
        <Chip
          tagName="a"
          emoji={<LucideUsers class={styles.icon} />}
          class="text-foreground decoration-none hover:decoration-underline"
          text={compact.format(props.anime.popularity ?? 0)}
          title="Popularity [Visit AniList]"
          onClick={(event) => event.stopPropagation()}
          attributes={{
            href: `https://anilist.co/anime/${props.anime.id}`,
            target: '_blank',
            rel: 'noopener noreferrer',
          }}
        />
      }
    >
      <Card class="w-[640px] flex overflow-hidden shadow-xl">
        <Show when={props.anime.coverImage?.large}>
          <img
            src={props.anime.coverImage!.large || ''}
            alt={props.anime.title?.userPreferred || ''}
            referrerPolicy="no-referrer"
            class="min-h-[340px] w-[240px] shrink-0 self-stretch object-cover"
          />
        </Show>
        <div class="min-w-0 flex flex-1 flex-col gap-3 px-[18px] py-4">
          <div class="flex flex-col gap-1.5">
            <Show when={props.anime.title?.userPreferred}>
              <h3 class="m-0 text-[17px] font-semibold leading-snug">
                <a
                  href={anilistUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-foreground decoration-none hover:decoration-underline"
                >
                  {props.anime.title!.userPreferred}
                </a>
              </h3>
            </Show>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
              <Show when={props.anime.status}>
                <span class="flex items-center gap-1.5 text-foreground font-semibold">
                  <span
                    aria-hidden="true"
                    class={`size-[7px] rounded-full ${statusColors[props.anime.status!] ?? 'bg-muted-foreground'}`}
                  />
                  {titleCase(props.anime.status!)}
                </span>
              </Show>
              <Show when={props.anime.format}>
                <span>{formatName(props.anime.format!)}</span>
              </Show>
              <Show when={props.anime.episodes}>
                <span>{props.anime.episodes} episodes</span>
              </Show>
              <Show when={props.anime.season && props.anime.seasonYear}>
                <span>
                  {titleCase(props.anime.season!)} {props.anime.seasonYear}
                </span>
              </Show>
            </div>
          </div>
          <Show when={props.anime.genres?.length}>
            <div class="flex flex-wrap gap-1.5">
              <For each={props.anime.genres}>
                {(genre) => (
                  <span class="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                    {genre}
                  </span>
                )}
              </For>
            </div>
          </Show>
          <Show when={props.anime.description}>
            <p class="m-0 text-[13px] text-muted-foreground leading-relaxed">
              {truncateText(props.anime.description!)}
            </p>
          </Show>
          <Show when={characters().length}>
            <section class="flex flex-col gap-2 border-t border-t-solid border-border pt-3">
              <div class="flex items-baseline justify-between">
                <h4 class={heading}>Characters</h4>
                <a
                  href={`${anilistUrl()}/characters`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-muted-foreground decoration-none hover:text-foreground"
                >
                  All
                </a>
              </div>
              <ul class="m-0 flex list-none gap-2.5 p-0">
                <For each={characters()}>
                  {(character) => (
                    <li>
                      <a
                        href={character.node.siteUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={character.node.name?.userPreferred || undefined}
                        class="w-[50px] flex flex-col items-center gap-1 text-foreground decoration-none"
                      >
                        <Show
                          when={character.node.image?.large}
                          fallback={
                            <span class="size-[42px] rounded-full bg-secondary" />
                          }
                        >
                          <img
                            src={character.node.image!.large || ''}
                            alt={character.node.name?.userPreferred || ''}
                            referrerPolicy="no-referrer"
                            class="size-[42px] rounded-full object-cover"
                          />
                        </Show>
                        <span class="max-w-full truncate text-[10.5px] leading-tight">
                          {firstName(character.node.name?.userPreferred)}
                        </span>
                      </a>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>
          <Show when={relations().length}>
            <section class="flex flex-col gap-2">
              <h4 class={heading}>Related</h4>
              <ul class="grid grid-cols-2 m-0 list-none gap-2 p-0">
                <For each={relations().slice(0, 4)}>
                  {(relation) => (
                    <li class="min-w-0">
                      <a
                        href={relation.node.siteUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-center gap-2.5 rounded-lg bg-secondary p-1.5 text-foreground decoration-none transition-colors hover:bg-secondary/70"
                      >
                        <Show
                          when={relation.node.coverImage?.large}
                          fallback={
                            <span class="h-9 w-[26px] shrink-0 rounded bg-muted" />
                          }
                        >
                          <img
                            src={relation.node.coverImage!.large || ''}
                            alt={relation.node.title?.userPreferred || ''}
                            referrerPolicy="no-referrer"
                            class="h-9 w-[26px] shrink-0 rounded object-cover"
                          />
                        </Show>
                        <span class="min-w-0 flex flex-col">
                          <span class="truncate text-xs font-semibold">
                            {relation.node.title?.userPreferred
                              || formatName(
                                relation.node.format
                                  || relation.node.type
                                  || '',
                              )}
                          </span>
                          <span class="truncate text-[11px] text-muted-foreground">
                            {relationLabel(relation)}
                          </span>
                        </span>
                      </a>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>
          <Show when={props.anime.tags?.length}>
            <div class="flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
              <span class="text-foreground font-semibold">Tags</span>
              <For each={props.anime.tags!.slice(0, 5)}>
                {(tag) => <span>{tag?.name}</span>}
              </For>
              <Show when={props.anime.tags!.length > 5}>
                <a
                  href={anilistUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted-foreground hover:text-foreground"
                >
                  +{props.anime.tags!.length - 5} more
                </a>
              </Show>
            </div>
          </Show>
        </div>
      </Card>
    </Popover>
  );
};
