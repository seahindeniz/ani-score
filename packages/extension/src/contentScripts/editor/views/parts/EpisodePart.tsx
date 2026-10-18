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

import type { NumberKind } from '../../logic/analyze';
import { numberCandidates, numberSteps } from '../../logic/analyze';
import { firstExtract } from '../../logic/detect';
import { stepPresets } from '../../logic/stepPresets';
import { useEditor } from '../context';
import { Advanced, Result, Waiting, Warning } from '../controls';
import { FieldEditor } from '../FieldEditor';
import { FieldChoices } from './FieldChoices';
import { createCardPicker } from './pick';
import type { CardPartProps, Summary } from './types';
import { cardCount } from './types';

const number = (card: Element, field: SiteField | undefined) => {
  if (!field) return undefined;

  const value = Number.parseInt(readField(card, field));

  return Number.isNaN(value) ? undefined : value;
};

// What the page shows where the number is read, before the steps keep only the number
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

export interface NumberRead {
  element: HTMLElement;
  shown: string;
  value: number | undefined;
}

export const readNumbers = (
  card: SiteCard,
  kind: NumberKind,
  elements: HTMLElement[],
): NumberRead[] =>
  elements.map((element) => ({
    element,
    shown: shownText(element, firstExtract(card[kind])),
    value: number(element, card[kind]),
  }));

const countRead = (card: SiteCard, kind: NumberKind, elements: HTMLElement[]) =>
  readNumbers(card, kind, elements).filter(({ value }) => value != null).length;

export function episodeSummary(
  card: SiteCard,
  elements: HTMLElement[],
): Summary {
  if (!card.episode) return { text: 'Not read', status: 'none' };

  const read = countRead(card, 'episode', elements);
  const all = read === elements.length && read > 0;

  return {
    text: `Read on ${read} of ${cardCount(elements.length)}`,
    status: all || (read && card.allowMissingEpisode) ? 'ok' : 'issue',
  };
}

export function seasonSummary(
  card: SiteCard,
  elements: HTMLElement[],
): Summary {
  if (!card.season) return { text: 'Not read', status: 'none' };

  const read = countRead(card, 'season', elements);

  // Sites often leave out the first season, so cards without one are fine
  return read
    ? { text: `Read on ${read} of ${cardCount(elements.length)}`, status: 'ok' }
    : { text: 'No season on this page', status: 'none' };
}

const kindName = { episode: 'Episode', season: 'Season' };

export function describeRead(
  kind: NumberKind,
  value: number | undefined,
  card?: SiteCard,
) {
  if (value != null) return `${kindName[kind]} ${value}`;
  if (kind === 'season') return 'None, the first season';

  return card?.allowMissingEpisode
    ? 'No episode, still scored'
    : 'Nothing, card skipped';
}

const firstNumber = stepPresets.find(({ id }) => id === 'first-number')!.steps;

const copy = {
  episode: {
    choices: 'Where the episode number is',
    waiting: 'Waiting for your click on an episode',
    pick: 'Pick the episode text in one of the outlined cards.',
    none: 'This site shows no episode numbers',
    nothingFound: '',
  },
  season: {
    choices: 'Where the season is',
    waiting: 'Waiting for your click on a season',
    pick: '',
    none: "Cards don't show a season",
    nothingFound:
      "AniScore found no season on these cards. If they show one, pick it on the page; if not, they're first seasons.",
  },
};

/**
 * A number each card shows, the episode or the season: where the editor found one, or where the user picks it.
 */
const NumberPart: Component<CardPartProps & { kind: NumberKind }> = (props) => {
  const editor = useEditor();
  const pickInCard = createCardPicker(() => props.elements());
  const field = () => props.card[props.kind];
  const setField = (value: SiteField | undefined) =>
    props.onChange({ ...props.card, [props.kind]: value });
  const candidates = createMemo(() => {
    editor.pageVersion();

    return numberCandidates(props.elements(), props.kind);
  });
  const reads = createMemo(() => {
    editor.pageVersion();

    return readNumbers(props.card, props.kind, props.elements());
  });
  const missing = () =>
    props.kind === 'episode' && field()
      ? reads().filter(({ value }) => value == null)
      : [];
  const text = () => copy[props.kind];

  async function pick() {
    const picked = await pickInCard();

    if (!picked) return;

    const location = { selector: picked.selector || undefined };

    setField({
      ...location,
      steps: numberSteps(props.elements(), location, props.kind) ?? firstNumber,
    });
  }

  // The guided setup starts from the best place found, or waits for a pick when there's none
  onMount(() => {
    if (!props.autoPick || field()) return;

    const [best] = candidates();

    if (best) setField(best.extract);
    else if (props.kind === 'episode') void pick();
  });

  createEffect(() =>
    onCleanup(
      editor.mark({
        card: field() ? [] : props.elements(),
        skipped: props.card.allowMissingEpisode
          ? []
          : missing().map(({ element }) => element),
        part: field()
          ? reads().flatMap(({ element, value }) => {
              const extract = firstExtract(field());
              const target = extract?.selector
                ? element.querySelector(extract.selector)
                : element;

              return value != null && target ? [target] : [];
            })
          : [],
      }),
    ),
  );

  const missingTitle = () =>
    readField(missing()[0].element, props.card.title) || 'One card';
  const readCount = () => reads().filter(({ value }) => value != null).length;

  return (
    <>
      <Show
        when={candidates().length || field()}
        fallback={
          <Show
            when={props.kind === 'episode'}
            fallback={
              <p class="m-0 text-[13px] leading-normal text-muted-foreground">
                {text().nothingFound}
              </p>
            }
          >
            <Waiting onPick={() => void pick()}>
              {editor.picking() ? text().waiting : text().pick}
            </Waiting>
          </Show>
        }
      >
        <FieldChoices
          label={text().choices}
          candidates={candidates()}
          field={field()}
          onChange={setField}
          describe={(candidate) =>
            `${kindName[props.kind]} ${candidate.reads.find(Boolean)}, on ${candidate.reads.filter(Boolean).length} of ${cardCount(candidate.reads.length)}`
          }
          none={
            props.kind === 'season' || props.advanced ? text().none : undefined
          }
        />
      </Show>
      <Show when={candidates().length || field() || props.kind === 'season'}>
        <UiButton
          variant="link"
          size="inline"
          class="self-start px-0 text-violet-400"
          onClick={() => void pick()}
        >
          {editor.picking() ? text().waiting : 'Pick it on the page'}
        </UiButton>
      </Show>
      <Show when={field()}>
        <Result
          title={
            readCount() === reads().length
              ? `Read ${props.kind === 'season' ? 'a season' : 'an episode'} on all ${cardCount(reads().length)}`
              : `Read ${props.kind === 'season' ? 'a season' : 'an episode'} on ${readCount()} of ${cardCount(reads().length)}`
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
                          props.kind === 'episode'
                          && read.value == null
                          && !props.card.allowMissingEpisode,
                      }}
                    >
                      {describeRead(props.kind, read.value, props.card)}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Result>
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
                onClick={() =>
                  props.onChange({
                    ...props.card,
                    allowMissingEpisode: undefined,
                  })
                }
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
              onClick={() =>
                props.onChange({ ...props.card, allowMissingEpisode: true })
              }
            >
              Score cards without an episode too
            </UiButton>
          </Warning>
        </Show>
      </Show>
      <Show when={props.advanced}>
        <Advanced>
          <FieldEditor
            label={kindName[props.kind]}
            field={field()}
            cards={props.elements}
            numeric
            optional
            onChange={setField}
          />
        </Advanced>
      </Show>
    </>
  );
};

/**
 * The episode number in each card.
 */
export const EpisodePart: Component<CardPartProps> = (props) => (
  <NumberPart kind="episode" {...props} />
);

/**
 * The season in each card, which later seasons need to find their own entry on AniList.
 */
export const SeasonPart: Component<CardPartProps> = (props) => (
  <NumberPart kind="season" {...props} />
);
