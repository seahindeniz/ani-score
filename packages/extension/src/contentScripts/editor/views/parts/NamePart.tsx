import type { Component } from 'solid-js';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';

import { Button as UiButton } from '~/components/ui/button';
import { readField } from '~/contentScripts/sites/extract';
import type { SiteCard, SiteField } from '~/sites/schema';

import { holdsMore, isRepeated, nameCandidates } from '../../logic/analyze';
import { firstExtract } from '../../logic/detect';
import { useEditor } from '../context';
import { Advanced, Notice, Result, Waiting, Warning } from '../controls';
import { FieldEditor } from '../FieldEditor';
import { FieldChoices } from './FieldChoices';
import { createCardPicker } from './pick';
import type { CardPartProps, Summary } from './types';
import { cardCount } from './types';

/**
 * A field nothing was picked for yet: it reads the whole card, which a new card starts with.
 */
export const isUnset = (field: SiteField) =>
  JSON.stringify(field) === JSON.stringify({});

const target = (card: Element, field: SiteField | undefined) => {
  const selector = firstExtract(field)?.selector;

  return selector ? card.querySelector(selector) : card;
};

export const readNames = (card: SiteCard, elements: HTMLElement[]) =>
  elements.map((element) => readField(element, card.title));

/**
 * Whether names hold more than the name, like the season or the episode, which keeps AniList from finding the anime.
 */
const mixed = (names: string[]) =>
  names.some((name) => holdsMore(name) || isRepeated(name));

export function nameSummary(card: SiteCard, elements: HTMLElement[]): Summary {
  const names = readNames(card, elements);
  const read = names.filter(Boolean).length;

  if (mixed(names)) {
    return { text: 'Names include more than the name', status: 'issue' };
  }

  return {
    text: `Read on ${read} of ${cardCount(elements.length)}`,
    status: read && read === elements.length ? 'ok' : 'issue',
  };
}

/**
 * The anime's name in each card, which AniScore looks up on AniList. When the text picked holds more, like the season
 * and the episode, it offers the places that read the name alone.
 */
export const NamePart: Component<CardPartProps> = (props) => {
  const editor = useEditor();
  const pickInCard = createCardPicker(() => props.elements());
  // The element the user picked, which the suggestions start from
  const [anchor, setAnchor] = createSignal(
    // eslint-disable-next-line solid/reactivity -- where it starts, the picks change it
    firstExtract(props.card.title)?.selector,
  );
  const [suggesting, setSuggesting] = createSignal(false);
  const unset = () => props.autoPick && isUnset(props.card.title);
  const names = createMemo(() => {
    editor.pageVersion();

    return readNames(props.card, props.elements());
  });
  const read = () => names().filter(Boolean);
  const candidates = createMemo(() => {
    editor.pageVersion();

    return suggesting() ? nameCandidates(props.elements(), anchor()) : [];
  });
  const whole = (): SiteField => {
    const selector = anchor();

    return selector ? { selector } : {};
  };
  const update = (title: SiteField) => props.onChange({ ...props.card, title });

  // Once the names are mixed up, the suggestions stay, also after choosing a clean one
  createEffect(() => {
    if (!unset() && mixed(names())) setSuggesting(true);
  });

  async function pick() {
    const picked = await pickInCard();

    if (!picked) return;

    const selector = picked.selector || undefined;

    const plain = selector ? { selector } : {};
    const holdsMoreThanName = mixed(
      props.elements().map((card) => readField(card, plain)),
    );

    setAnchor(selector);
    setSuggesting(holdsMoreThanName);
    update(
      holdsMoreThanName
        ? (nameCandidates(props.elements(), selector)[0]?.extract ?? plain)
        : plain,
    );
  }

  onMount(() => {
    if (unset()) void pick();
  });

  createEffect(() =>
    onCleanup(
      editor.mark({
        card: props.elements(),
        part: unset()
          ? []
          : props
              .elements()
              .flatMap((card) => target(card, props.card.title) ?? []),
      }),
    ),
  );

  return (
    <>
      <Show
        when={!unset()}
        fallback={
          <Waiting onPick={() => void pick()}>
            {editor.picking()
              ? 'Waiting for your click on a name'
              : 'Pick a name in one of the outlined cards.'}
          </Waiting>
        }
      >
        <Show when={suggesting()}>
          <Notice title="This text holds more than the name">
            <p class="m-0 text-muted-foreground">
              It also has the season, the episode or other words. AniScore looks
              the anime up by its name alone, so choose what reads as just the
              name:
            </p>
            <FieldChoices
              label="The name"
              candidates={candidates()}
              field={props.card.title}
              onChange={(title) => update(title ?? {})}
              describe={(candidate) => candidate.reads.find(Boolean) ?? ''}
              other={{
                label: 'The whole text',
                description: "AniList won't find most anime by it",
                field: whole(),
              }}
            />
          </Notice>
        </Show>
        <Result
          title={
            read().length === names().length
              ? `Read a name on all ${cardCount(names().length)}`
              : `Read a name on ${read().length} of ${cardCount(names().length)}`
          }
        >
          <ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
            <For each={read().slice(0, 4)}>{(name) => <li>{name}</li>}</For>
            <Show when={read().length > 4}>
              <li class="text-muted-foreground">
                and {read().length - 4} more
              </li>
            </Show>
          </ul>
        </Result>
        <Show when={read().length < names().length}>
          <Warning>
            {names().length - read().length === 1
              ? 'One card has no name where you picked, so it gets no score. Pick the name in that card, or add a fallback under Advanced.'
              : `${names().length - read().length} cards have no name where you picked, so they get no score. Pick the name in one of them, or add a fallback under Advanced.`}
          </Warning>
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
            label="Name"
            field={props.card.title}
            cards={props.elements}
            onChange={(title) => update(title ?? {})}
          />
        </Advanced>
      </Show>
    </>
  );
};
