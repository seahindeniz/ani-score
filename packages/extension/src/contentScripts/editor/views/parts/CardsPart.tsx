import type { Component } from 'solid-js';
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';

import { Button as UiButton } from '~/components/ui/button';
import type { SiteCard } from '~/sites/schema';

import { generalizeCardSelector } from '../../logic/selectors';
import { useEditor } from '../context';
import {
  Advanced,
  Button,
  Field,
  Result,
  TextInput,
  Waiting,
  Warning,
} from '../controls';
import { createCardPicker, createPicker } from './pick';
import type { CardPartProps, Summary } from './types';
import { cardCount } from './types';

export function cardsSummary(elements: HTMLElement[]): Summary {
  return elements.length
    ? { text: `${elements.length} on this page`, status: 'ok' }
    : { text: 'None on this page', status: 'issue' };
}

/**
 * The cards: pick one, and AniScore finds the ones like it.
 */
export const CardsPart: Component<CardPartProps> = (props) => {
  const editor = useEditor();
  const pick = createPicker();
  const pickInCard = createCardPicker(() => props.elements());
  // The selectors "Make bigger" replaced, so "Make smaller" can go back
  const [narrower, setNarrower] = createSignal<string[]>([]);
  const update = (changes: Partial<SiteCard>) =>
    props.onChange({ ...props.card, ...changes });

  async function pickCard() {
    const element = await pick();
    const selector = element && generalizeCardSelector(element);

    if (!selector) return;

    setNarrower([]);
    update({ selector });
  }

  // The next repeating element around the cards, e.g. the grid cell around a card's link
  function bigger() {
    const parent = props.elements()[0]?.parentElement;
    const selector = parent && generalizeCardSelector(parent);

    if (!selector) return;

    setNarrower((list) => [...list, props.card.selector]);
    update({ selector });
  }

  function smaller() {
    const list = narrower();

    setNarrower(list.slice(0, -1));
    update({ selector: list.at(-1)! });
  }

  async function pickHas() {
    const picked = await pickInCard();

    if (picked?.selector) update({ has: picked.selector });
  }

  onMount(() => {
    if (props.autoPick && !props.elements().length) void pickCard();
  });

  createEffect(() => onCleanup(editor.mark({ card: props.elements() })));

  return (
    <>
      <Show
        when={props.elements().length}
        fallback={
          <Waiting onPick={() => void pickCard()}>
            {editor.picking()
              ? 'Waiting for your click on the page'
              : props.card.selector
                ? 'No cards like this on this page. Pick one.'
                : 'Pick a card on the page.'}
          </Waiting>
        }
      >
        <Result title={`Found ${cardCount(props.elements().length)}`}>
          <p class="m-0 text-[13px] leading-normal text-muted-foreground">
            Each one has a dashed outline on the page. If the outline covers
            only part of a card, or more than one card, adjust it:
          </p>
          <div class="flex gap-2">
            <UiButton size="sm" variant="outline" onClick={bigger}>
              Make bigger
            </UiButton>
            <UiButton
              size="sm"
              variant="outline"
              disabled={!narrower().length}
              onClick={smaller}
            >
              Make smaller
            </UiButton>
          </div>
        </Result>
        <Show when={props.elements().length === 1}>
          <Warning>
            Only one card has this outline. Pick a card that sits among others,
            or make the outline bigger.
          </Warning>
        </Show>
        <UiButton
          variant="link"
          size="inline"
          class="self-start px-0 text-violet-400"
          onClick={() => void pickCard()}
        >
          Pick a different card
        </UiButton>
      </Show>
      <Show when={props.advanced}>
        <Advanced>
          <Field
            label="Card selector"
            hint="The outermost element of each card, the one that sits next to the other cards"
          >
            <TextInput
              value={props.card.selector}
              onValue={(selector) => {
                setNarrower([]);
                update({ selector });
              }}
            />
          </Field>
          <Field label="Skip cards in" hint="e.g. a carousel's copies">
            <TextInput
              value={props.card.exclude ?? ''}
              onValue={(exclude) => update({ exclude: exclude || undefined })}
            />
          </Field>
          <Field label="Only cards with" hint="e.g. a link to an episode">
            <div class="flex gap-1">
              <TextInput
                value={props.card.has ?? ''}
                onValue={(has) => update({ has: has || undefined })}
              />
              <Button
                aria-label="Pick what cards must have"
                onClick={() => void pickHas()}
              >
                Pick
              </Button>
            </div>
          </Field>
        </Advanced>
      </Show>
    </>
  );
};
