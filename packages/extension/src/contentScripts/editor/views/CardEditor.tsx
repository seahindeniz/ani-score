import type { Component } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';

import { readCard } from '~/contentScripts/sites/extract';
import type { SiteCard } from '~/sites/schema';

import { generalizeCardSelector, relativeSelector } from '../logic/selectors';
import { useEditor } from './context';
import { Button, Field, Section, Select, TextInput } from './controls';
import { FieldEditor } from './FieldEditor';

const positions: { value: SiteCard['inject']['position']; label: string }[] = [
  { value: 'after', label: 'After it' },
  { value: 'before', label: 'Before it' },
  { value: 'append', label: 'Inside it, at the end' },
  { value: 'prepend', label: 'Inside it, at the start' },
];

/**
 * The elements a card type matches on the page, as the runtime filters them.
 */
export function cardElements(card: SiteCard) {
  try {
    return Array.from(
      document.querySelectorAll<HTMLElement>(card.selector || ':not(*)'),
    ).filter(
      (element) =>
        !(card.exclude && element.closest(card.exclude))
        && !(card.has && !element.querySelector(card.has)),
    );
  } catch {
    // A selector being typed
    return [];
  }
}

export const CardEditor: Component<{
  card: SiteCard;
  index: number;
  onChange: (card: SiteCard) => void;
  onRemove?: () => void;
}> = (props) => {
  const editor = useEditor();
  const elements = createMemo(() => {
    editor.pageVersion();

    return cardElements(props.card);
  });
  const update = (changes: Partial<SiteCard>) =>
    props.onChange({ ...props.card, ...changes });
  const cardOf = (element: Element) =>
    elements().find((card) => card.contains(element));

  // Picks an element inside one of the cards, as a selector relative to it
  async function pickInCard() {
    const element = await editor.pick({
      resolve: (target) => (cardOf(target) ? target : null),
    });

    return element && relativeSelector(cardOf(element)!, element);
  }

  async function pickHas() {
    const has = await pickInCard();

    if (has) update({ has });
  }

  async function pickInject() {
    const selector = await pickInCard();

    if (selector !== undefined) {
      update({
        inject: { ...props.card.inject, selector: selector || undefined },
      });
    }
  }

  async function pickShimmer() {
    const selector = await pickInCard();

    if (selector !== undefined) {
      update({ shimmer: { selector: selector || undefined } });
    }
  }

  async function pickCard() {
    const element = await editor.pick();
    const selector = element && generalizeCardSelector(element);

    if (selector) update({ selector });
  }

  // The next repeating element around the current cards, e.g. a grid cell around the card's link
  function widen() {
    const parent = elements()[0]?.parentElement;
    const selector = parent && generalizeCardSelector(parent);

    if (selector) update({ selector });
  }

  const preview = createMemo(() => {
    editor.pageVersion();

    return elements()
      .slice(0, 5)
      .map((element) => readCard(element, props.card));
  });

  return (
    <Section
      title={`Card type ${props.index + 1}`}
      actions={
        <Show when={props.onRemove}>
          <Button onClick={() => props.onRemove!()}>Remove</Button>
        </Show>
      }
    >
      <Field
        label="Card"
        hint="The outermost element of each card, the one that sits next to the other cards"
      >
        <div class="flex gap-1">
          <TextInput
            aria-label="Card selector"
            value={props.card.selector}
            onValue={(selector) => update({ selector })}
          />
          <Button variant="primary" aria-label="Pick a card" onClick={pickCard}>
            Pick
          </Button>
          <Button
            aria-label="Widen to the element around the cards"
            onClick={widen}
            disabled={!elements().length}
          >
            Wider
          </Button>
        </div>
      </Field>
      <span class="text-[11px]" role="status">
        {elements().length === 1
          ? '1 card on this page'
          : `${elements().length} cards on this page`}
      </span>
      <div class="grid grid-cols-2 gap-2">
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
      </div>
      <FieldEditor
        label="Title"
        field={props.card.title}
        cards={elements}
        onChange={(title) => update({ title: title ?? {} })}
      />
      <FieldEditor
        label="Episode"
        field={props.card.episode}
        cards={elements}
        numeric
        optional
        onChange={(episode) => update({ episode })}
      />
      <FieldEditor
        label="Season"
        field={props.card.season}
        cards={elements}
        numeric
        optional
        onChange={(season) => update({ season })}
      />
      <Section title="Details">
        <Field
          label="Show the details next to"
          hint="Empty means the card itself"
        >
          <div class="flex gap-1">
            <TextInput
              placeholder="The card itself"
              value={props.card.inject.selector ?? ''}
              onValue={(selector) =>
                update({
                  inject: {
                    ...props.card.inject,
                    selector: selector || undefined,
                  },
                })
              }
            />
            <Button
              aria-label="Pick where the details go"
              onClick={() => void pickInject()}
            >
              Pick
            </Button>
          </div>
        </Field>
        <Select
          aria-label="Position"
          value={props.card.inject.position}
          options={positions}
          onValue={(position) =>
            update({ inject: { ...props.card.inject, position } })
          }
        />
      </Section>
      <Section
        title="Shimmer"
        actions={
          <Show
            when={props.card.shimmer}
            fallback={
              <Button onClick={() => update({ shimmer: {} })}>
                Shimmer while watching
              </Button>
            }
          >
            <Button onClick={() => update({ shimmer: undefined })}>
              No shimmer
            </Button>
          </Show>
        }
      >
        <Show when={props.card.shimmer}>
          {(shimmer) => (
            <Field
              label="Element"
              hint="Usually the poster; empty means the card itself"
            >
              <div class="flex gap-1">
                <TextInput
                  placeholder="The card itself"
                  value={shimmer().selector ?? ''}
                  onValue={(selector) =>
                    update({ shimmer: { selector: selector || undefined } })
                  }
                />
                <Button
                  aria-label="Pick the shimmering element"
                  onClick={() => void pickShimmer()}
                >
                  Pick
                </Button>
              </div>
            </Field>
          )}
        </Show>
      </Section>
      <Section title="What AniScore reads">
        <ol
          class="m-0 flex flex-col gap-0.5 pl-4 text-[11px]"
          aria-label="Cards read"
        >
          <For each={preview()}>
            {(card) => (
              <li classList={{ 'text-destructive': !card }}>
                {card
                  ? `${card.title}${card.episodeNumber == null ? '' : ` · episode ${card.episodeNumber}`}`
                  : "Skipped: it's missing the title, the episode or the place for the details"}
              </li>
            )}
          </For>
        </ol>
      </Section>
    </Section>
  );
};
