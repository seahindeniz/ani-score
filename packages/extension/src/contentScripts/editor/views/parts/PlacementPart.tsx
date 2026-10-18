import type { Component } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';

import { Choice, ChoiceGroup } from '~/components/ui/choice-group';
import type { SiteCard } from '~/sites/schema';

import { firstExtract, posterOf } from '../../logic/detect';
import { relativeSelector } from '../../logic/selectors';
import { useEditor } from '../context';
import { Advanced, Button, Field, Select, TextInput } from '../controls';
import { createCardPicker } from './pick';
import type { CardPartProps, Summary } from './types';

type Inject = SiteCard['inject'];

type Spot = 'under' | 'above' | 'poster' | 'end';

interface Placement {
  id: Spot | 'custom';
  label: string;
  inject: Inject;
}

const positions: { value: Inject['position']; label: string }[] = [
  { value: 'after', label: 'After it' },
  { value: 'before', label: 'Before it' },
  { value: 'append', label: 'Inside it, at the end' },
  { value: 'prepend', label: 'Inside it, at the start' },
];

const same = (a: Inject, b: Inject) =>
  (a.selector ?? '') === (b.selector ?? '') && a.position === b.position;

/**
 * The spots offered for the details, the ones this card's layout has: around the name, on the poster, at the end.
 */
export function placements(card: SiteCard, first: HTMLElement | undefined) {
  const name = firstExtract(card.title)?.selector;
  const poster = first && posterOf(first);
  const list: Placement[] = [];

  if (name) {
    list.push(
      {
        id: 'under',
        label: 'Under the name',
        inject: { selector: name, position: 'after' },
      },
      {
        id: 'above',
        label: 'Above the name',
        inject: { selector: name, position: 'before' },
      },
    );
  }

  if (poster) {
    list.push({
      id: 'poster',
      label: 'On the poster',
      inject: { selector: relativeSelector(first, poster), position: 'append' },
    });
  }

  list.push({
    id: 'end',
    label: 'End of the card',
    inject: { position: 'append' },
  });

  return list;
}

export const currentPlacement = (card: SiteCard, list: Placement[]) =>
  list.find((placement) => same(placement.inject, card.inject)) ?? {
    id: 'custom' as const,
    label: 'Where you set it',
    inject: card.inject,
  };

export const placementSummary = (
  card: SiteCard,
  elements: HTMLElement[],
): Summary => ({
  text: currentPlacement(card, placements(card, elements[0])).label,
  status: 'none',
});

interface Shape {
  kind: 'poster' | 'text' | 'details';
  x?: number;
  y: number;
  width: number;
  height: number;
}

// A card in each spot's layout, the details as the accent bar
const shapes: Record<Spot, Shape[]> = {
  under: [
    { kind: 'poster', y: 6, width: 52, height: 16 },
    { kind: 'text', y: 26, width: 34, height: 4 },
    { kind: 'details', y: 33, width: 22, height: 5 },
    { kind: 'text', y: 41, width: 18, height: 3 },
  ],
  above: [
    { kind: 'poster', y: 6, width: 52, height: 16 },
    { kind: 'details', y: 26, width: 22, height: 5 },
    { kind: 'text', y: 34, width: 34, height: 4 },
    { kind: 'text', y: 41, width: 18, height: 3 },
  ],
  poster: [
    { kind: 'poster', y: 6, width: 52, height: 20 },
    { kind: 'details', x: 9, y: 18, width: 22, height: 5 },
    { kind: 'text', y: 30, width: 34, height: 4 },
    { kind: 'text', y: 38, width: 18, height: 3 },
  ],
  end: [
    { kind: 'poster', y: 6, width: 52, height: 16 },
    { kind: 'text', y: 26, width: 34, height: 4 },
    { kind: 'text', y: 33, width: 18, height: 3 },
    { kind: 'details', y: 39, width: 22, height: 5 },
  ],
};

const fills = {
  poster: 'fill-muted',
  text: 'fill-muted-foreground/60',
  details: 'fill-violet-400',
};

const Illustration: Component<{ spot: Spot }> = (props) => (
  <svg width="64" height="48" viewBox="0 0 64 48" aria-hidden="true">
    <rect
      x="0.5"
      y="0.5"
      width="63"
      height="47"
      rx="4"
      fill="none"
      class="stroke-muted-foreground/60"
    />
    <For each={shapes[props.spot]}>
      {(shape) => (
        <rect
          x={shape.x ?? 6}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx="2"
          class={fills[shape.kind]}
        />
      )}
    </For>
  </svg>
);

/**
 * Where on each card AniScore shows its details.
 */
export const PlacementPart: Component<CardPartProps> = (props) => {
  const editor = useEditor();
  const pickInCard = createCardPicker(() => props.elements());
  const list = createMemo(() => {
    editor.pageVersion();

    return placements(props.card, props.elements()[0]);
  });
  const current = () => currentPlacement(props.card, list());
  const choices = () =>
    current().id === 'custom' ? [...list(), current()] : list();
  const setInject = (inject: Inject) =>
    props.onChange({ ...props.card, inject });

  async function pick() {
    const picked = await pickInCard();

    if (picked) {
      setInject({
        ...props.card.inject,
        selector: picked.selector || undefined,
      });
    }
  }

  return (
    <>
      <ChoiceGroup
        label="Where the score goes"
        value={current().id}
        class="grid grid-cols-2"
        onChange={(id) =>
          setInject(choices().find((choice) => choice.id === id)!.inject)
        }
      >
        <For each={choices()}>
          {(choice) => (
            <Choice
              value={choice.id}
              label={choice.label}
              description={choice.id === 'under' ? 'Suggested' : undefined}
              illustration={
                choice.id === 'custom' ? undefined : (
                  <Illustration spot={choice.id} />
                )
              }
            />
          )}
        </For>
      </ChoiceGroup>
      <Show when={props.advanced}>
        <Advanced>
          <Field
            label="Show the details next to"
            hint="Empty means the card itself"
          >
            <div class="flex gap-1">
              <TextInput
                placeholder="The card itself"
                value={props.card.inject.selector ?? ''}
                onValue={(selector) =>
                  setInject({
                    ...props.card.inject,
                    selector: selector || undefined,
                  })
                }
              />
              <Button
                aria-label="Pick where the details go"
                onClick={() => void pick()}
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
              setInject({ ...props.card.inject, position })
            }
          />
        </Advanced>
      </Show>
    </>
  );
};
