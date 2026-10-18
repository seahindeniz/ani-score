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
import type { SiteCard, SiteField } from '~/sites/schema';

import { firstExtract } from '../../logic/detect';
import { useEditor } from '../context';
import { Advanced, Result, Waiting, Warning } from '../controls';
import { FieldEditor } from '../FieldEditor';
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

export function nameSummary(card: SiteCard, elements: HTMLElement[]): Summary {
  const read = readNames(card, elements).filter(Boolean).length;

  return {
    text: `Read on ${read} of ${cardCount(elements.length)}`,
    status: read && read === elements.length ? 'ok' : 'issue',
  };
}

/**
 * The anime's name in each card, which AniScore looks up on AniList.
 */
export const NamePart: Component<CardPartProps> = (props) => {
  const editor = useEditor();
  const pickInCard = createCardPicker(() => props.elements());
  const unset = () => props.autoPick && isUnset(props.card.title);
  const names = createMemo(() => {
    editor.pageVersion();

    return readNames(props.card, props.elements());
  });
  const read = () => names().filter(Boolean);

  async function pick() {
    const picked = await pickInCard();

    if (picked) {
      props.onChange({
        ...props.card,
        title: picked.selector ? { selector: picked.selector } : {},
      });
    }
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
            onChange={(title) =>
              props.onChange({ ...props.card, title: title ?? {} })
            }
          />
        </Advanced>
      </Show>
    </>
  );
};
