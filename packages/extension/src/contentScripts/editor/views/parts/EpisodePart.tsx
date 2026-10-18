import type { Component } from 'solid-js';
import {
  createEffect,
  createMemo,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';

import { Button as UiButton } from '~/components/ui/button';
import { readField } from '~/contentScripts/sites/extract';
import type { SiteCard, SiteExtract, SiteField } from '~/sites/schema';

import { detectSteps, firstExtract } from '../../logic/detect';
import { stepPresets } from '../../logic/stepPresets';
import { useEditor } from '../context';
import { Advanced, Checkbox, Result, Waiting, Warning } from '../controls';
import { FieldEditor } from '../FieldEditor';
import { createCardPicker } from './pick';
import type { CardPartProps, Summary } from './types';
import { cardCount } from './types';

const number = (card: Element, field: SiteField | undefined) => {
  if (!field) return undefined;

  const value = Number.parseInt(readField(card, field));

  return Number.isNaN(value) ? undefined : value;
};

// What the page shows where the episode is read, before the steps keep only the number
function shownText(card: Element, extract: SiteExtract | undefined) {
  const element = extract?.selector
    ? card.querySelector(extract.selector)
    : card;
  const text =
    typeof extract?.source === 'object'
      ? element?.getAttribute(extract.source.attr)
      : element?.textContent;

  return text?.replace(/\s+/g, ' ').trim() ?? '';
}

export interface EpisodeRead {
  element: HTMLElement;
  shown: string;
  episode: number | undefined;
  season: number | undefined;
}

export const readEpisodes = (
  card: SiteCard,
  elements: HTMLElement[],
): EpisodeRead[] =>
  elements.map((element) => ({
    element,
    shown: shownText(element, firstExtract(card.episode)),
    episode: number(element, card.episode),
    season: number(element, card.season),
  }));

export function episodeSummary(
  card: SiteCard,
  elements: HTMLElement[],
): Summary {
  if (!card.episode) return { text: 'Not read', status: 'none' };

  const read = readEpisodes(card, elements).filter(
    ({ episode }) => episode != null,
  ).length;
  const all = read === elements.length && read > 0;

  return {
    text: `Read on ${read} of ${cardCount(elements.length)}${card.season ? ', with the season' : ''}`,
    status: all || (read && card.allowMissingEpisode) ? 'ok' : 'issue',
  };
}

export const describeRead = ({ episode, season }: EpisodeRead) =>
  episode == null
    ? 'Nothing, card skipped'
    : season == null
      ? `Episode ${episode}`
      : `Season ${season}, episode ${episode}`;

const firstNumber = stepPresets.find(({ id }) => id === 'first-number')!.steps;

/**
 * The episode number in each card, and the season when the cards show one.
 */
export const EpisodePart: Component<CardPartProps> = (props) => {
  const editor = useEditor();
  const pickInCard = createCardPicker(() => props.elements());
  const reads = createMemo(() => {
    editor.pageVersion();

    return readEpisodes(props.card, props.elements());
  });
  const missing = () => reads().filter(({ episode }) => episode == null);
  const seasonSteps = createMemo(() => {
    editor.pageVersion();

    return (
      props.card.episode
      && detectSteps(
        props.elements(),
        firstExtract(props.card.episode)?.selector,
        'season',
      )
    );
  });
  const update = (changes: Partial<SiteCard>) =>
    props.onChange({ ...props.card, ...changes });

  async function pick() {
    const picked = await pickInCard();

    if (!picked) return;

    const selector = picked.selector || undefined;
    const season = detectSteps(props.elements(), selector, 'season');

    update({
      episode: {
        selector,
        steps:
          detectSteps(props.elements(), selector, 'episode') ?? firstNumber,
      },
      season: season && { selector, steps: season },
    });
  }

  onMount(() => {
    if (props.autoPick && !props.card.episode) void pick();
  });

  createEffect(() =>
    onCleanup(
      editor.mark({
        card: props.card.episode ? [] : props.elements(),
        skipped: props.card.allowMissingEpisode
          ? []
          : missing().map(({ element }) => element),
        part: props.card.episode
          ? reads().flatMap(({ element, episode }) => {
              const extract = firstExtract(props.card.episode);
              const target = extract?.selector
                ? element.querySelector(extract.selector)
                : element;

              return episode != null && target ? [target] : [];
            })
          : [],
      }),
    ),
  );

  const missingTitle = () =>
    readField(missing()[0].element, props.card.title) || 'One card';

  return (
    <>
      <Show
        when={props.card.episode}
        fallback={
          <Waiting onPick={() => void pick()}>
            {editor.picking()
              ? 'Waiting for your click on an episode'
              : 'Pick the episode text in one of the outlined cards.'}
          </Waiting>
        }
      >
        <Result
          title={
            missing().length
              ? `Read an episode on ${reads().length - missing().length} of ${cardCount(reads().length)}`
              : `Read an episode on all ${cardCount(reads().length)}`
          }
        >
          <table class="w-full table-fixed border-collapse text-left text-[13px]">
            <thead>
              <tr class="text-muted-foreground">
                <th class="pb-1.5 font-normal">On the page</th>
                <th class="pb-1.5 font-normal">AniScore reads</th>
              </tr>
            </thead>
            <tbody>
              <For each={reads().slice(0, 3)}>
                {(read) => (
                  <tr>
                    <td class="truncate py-0.5 pr-3">{read.shown || '–'}</td>
                    <td
                      class="py-0.5"
                      classList={{
                        'text-amber-700 dark:text-amber-200':
                          read.episode == null,
                      }}
                    >
                      {describeRead(read)}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Result>
        <Show when={seasonSteps() || props.card.season}>
          <Checkbox
            label="Read the season too"
            hint="Without it, AniScore shows the first season's score on every season's episodes."
            checked={props.card.season !== undefined}
            onChange={(checked) => {
              const steps = seasonSteps();

              update({
                season:
                  checked && steps
                    ? {
                        selector: firstExtract(props.card.episode)?.selector,
                        steps,
                      }
                    : undefined,
              });
            }}
          />
        </Show>
        <Show when={missing().length}>
          <Show
            when={!props.card.allowMissingEpisode}
            fallback={
              <p class="m-0 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                Cards without an episode get a score too.
                <UiButton
                  variant="link"
                  size="inline"
                  class="px-0 text-violet-400"
                  onClick={() => update({ allowMissingEpisode: undefined })}
                >
                  Skip them instead
                </UiButton>
              </p>
            }
          >
            <Warning>
              <span>
                {missing().length === 1
                  ? `${missingTitle()} has no episode number, so it gets no score.`
                  : `${missing().length} cards have no episode number, so they get no score.`}{' '}
                Movies often don't have one.
              </span>
              <UiButton
                size="sm"
                variant="outline"
                class="bg-background"
                onClick={() => update({ allowMissingEpisode: true })}
              >
                Score cards without an episode too
              </UiButton>
            </Warning>
          </Show>
        </Show>
        <UiButton
          size="sm"
          variant="outline"
          class="self-start"
          onClick={() => void pick()}
        >
          Pick again
        </UiButton>
      </Show>
      <Show when={props.advanced}>
        <Advanced>
          <FieldEditor
            label="Episode"
            field={props.card.episode}
            cards={props.elements}
            numeric
            optional
            onChange={(episode) => update({ episode })}
          />
          <FieldEditor
            label="Season"
            field={props.card.season}
            cards={props.elements}
            numeric
            optional
            onChange={(season) => update({ season })}
          />
        </Advanced>
      </Show>
    </>
  );
};
