import type { Component } from 'solid-js';
import {
  createEffect,
  createMemo,
  For,
  Index,
  onCleanup,
  Show,
} from 'solid-js';

import { Button as UiButton } from '~/components/ui/button';
import { Choice, ChoiceGroup } from '~/components/ui/choice-group';
import type { SiteCard, SitePage } from '~/sites/schema';

import { posterOf } from '../../logic/detect';
import { elementSelector, relativeSelector } from '../../logic/selectors';
import type { FixedBox } from '../../logic/spacing';
import { detectSpacing, fixedBoxes } from '../../logic/spacing';
import { useEditor } from '../context';
import {
  Advanced,
  Button,
  Field,
  NumberInput,
  Range,
  Select,
  TextInput,
  Warning,
} from '../controls';
import { createFixedBoxes } from './fixedBoxes';
import { createCardPicker } from './pick';
import type { CardPartProps, Summary } from './types';
import { cardCount } from './types';

type Layout = NonNullable<SitePage['layout']>[number];
type Height = NonNullable<SitePage['heights']>[number];

type Glow = 'poster' | 'card' | 'other' | 'none';

function glowOf(card: SiteCard, poster: string | undefined): Glow {
  if (!card.shimmer) return 'none';
  if (!card.shimmer.selector) return 'card';

  return card.shimmer.selector === poster ? 'poster' : 'other';
}

const glowNames: Record<Glow, string> = {
  poster: 'The poster',
  card: 'The whole card',
  other: 'Another part',
  none: 'No highlight',
};

const methodNames: Record<NonNullable<Layout['spacing']>, string> = {
  gap: 'the gap between them',
  margin: 'their margins',
  padding: 'their padding',
};

const posterSelector = (first: HTMLElement | undefined) => {
  const poster = first && posterOf(first);

  return poster && relativeSelector(first, poster);
};

/**
 * The element around the cards, how the site spaces them, and the layout entry for it, if the page has one.
 */
function spacingOf(page: SitePage, elements: HTMLElement[]) {
  const site = elements[0] && detectSpacing(elements[0]);

  if (!site) return undefined;

  const selector = elementSelector(elements[0].parentElement!);

  return {
    selector,
    site,
    entry: page.layout?.find((layout) => layout.container === selector),
  };
}

export function highlightSummary(
  card: SiteCard,
  page: SitePage,
  elements: HTMLElement[],
): Summary {
  const gap = spacingOf(page, elements)?.entry?.gap;

  if (fixedBoxes(elements, card.selector).length) {
    return { text: 'Some cards cut the score off', status: 'issue' };
  }

  return {
    text: `${glowNames[glowOf(card, posterSelector(elements[0]))]}, ${gap == null ? "site's own spacing" : `${gap} px apart`}`,
    status: 'none',
  };
}

const LayoutFields: Component<{
  page: SitePage;
  onChange: (layout: Layout[] | undefined) => void;
}> = (props) => {
  const layout = () => props.page.layout ?? [];
  const set = (list: Layout[]) =>
    props.onChange(list.length ? list : undefined);

  return (
    <Index each={layout()}>
      {(item, index) => {
        const update = (changes: Partial<Layout>) =>
          set(
            layout().map((entry, at) =>
              at === index ? { ...entry, ...changes } : entry,
            ),
          );

        return (
          <div class="flex flex-col gap-1">
            <div class="flex gap-1">
              <TextInput
                aria-label="Container"
                value={item().container}
                onValue={(container) => update({ container })}
              />
              <Button
                aria-label="Remove spacing"
                onClick={() => set(layout().filter((_, at) => at !== index))}
              >
                ✕
              </Button>
            </div>
            <div class="grid grid-cols-2 gap-1">
              <Select
                aria-label="Layout"
                value={item().mode}
                options={[
                  { value: 'grid', label: 'Grid' },
                  { value: 'flex', label: 'Row' },
                  { value: 'block', label: 'Blocks' },
                ]}
                onValue={(mode) => update({ mode })}
              />
              <Select
                aria-label="Spaced by"
                value={item().spacing ?? 'gap'}
                options={[
                  { value: 'gap', label: 'Gap' },
                  { value: 'margin', label: "Cards' margins" },
                  { value: 'padding', label: "Cards' padding" },
                ]}
                onValue={(spacing) =>
                  update({ spacing: spacing === 'gap' ? undefined : spacing })
                }
              />
              <Field label="Space (px)">
                <NumberInput
                  value={item().gap}
                  onValue={(gap) => update({ gap })}
                />
              </Field>
              <Field label="Card width (px)">
                <NumberInput
                  value={item().minCardWidth}
                  onValue={(minCardWidth) => update({ minCardWidth })}
                />
              </Field>
            </div>
          </div>
        );
      }}
    </Index>
  );
};

type HeightChoice = 'site' | 'auto' | 'custom';

/**
 * Elements in the cards whose fixed height cuts the details off, each with the height to give it instead.
 */
const HeightsSection: Component<{
  boxes: FixedBox[];
  page: SitePage;
  onPageChange: (changes: Partial<SitePage>) => void;
}> = (props) => {
  const heights = () => props.page.heights ?? [];
  // What the site cuts off, and what the user set before (which no longer cuts anything off)
  const listed = createMemo(
    () => [
      ...props.boxes.filter(
        (box) => !heights().some((height) => height.selector === box.selector),
      ),
      ...heights().map((height) => {
        const box = props.boxes.find(
          (item) => item.selector === height.selector,
        );

        return {
          selector: height.selector,
          height:
            box?.height
            ?? (typeof height.height === 'number' ? height.height : 0),
          cards: box?.cards ?? 0,
        };
      }),
    ],
    [],
    // Drawn again only when they change, which would close an open dropdown
    { equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  const setHeight = (
    selector: string,
    height: Height['height'] | undefined,
  ) => {
    const others = heights().filter((entry) => entry.selector !== selector);
    const list =
      height === undefined ? others : [...others, { selector, height }];

    props.onPageChange({ heights: list.length ? list : undefined });
  };
  const choiceOf = (selector: string): HeightChoice => {
    const set = heights().find((entry) => entry.selector === selector)?.height;

    return set === undefined ? 'site' : set === 'auto' ? 'auto' : 'custom';
  };

  return (
    <Show when={listed().length}>
      <div class="flex flex-col gap-3 border-t border-t-solid border-border pt-4">
        <Show when={props.boxes.length}>
          <Warning>
            Part of the cards has a fixed height, so the score doesn't fit in
            it. Let it fit the score, or give it a height:
          </Warning>
        </Show>
        <For each={listed()}>
          {(box) => (
            <div class="flex flex-col gap-1.5 text-[13px]">
              <code class="break-all text-xs">{box.selector}</code>
              <span class="text-muted-foreground">
                {box.cards
                  ? `${box.height} px, too short on ${cardCount(box.cards)}`
                  : 'Height set here'}
              </span>
              <div class="flex gap-2">
                <Select
                  aria-label={`Height of ${box.selector}`}
                  class="h-8 flex-1"
                  value={choiceOf(box.selector)}
                  options={[
                    { value: 'site', label: "The site's height" },
                    { value: 'auto', label: 'Fit the content' },
                    { value: 'custom', label: 'Set a height' },
                  ]}
                  onValue={(choice) =>
                    setHeight(
                      box.selector,
                      choice === 'site'
                        ? undefined
                        : choice === 'auto'
                          ? 'auto'
                          : box.height + 40,
                    )
                  }
                />
                <Show when={choiceOf(box.selector) === 'custom'}>
                  <div class="w-24">
                    <NumberInput
                      aria-label={`Height of ${box.selector} in pixels`}
                      value={
                        heights().find(
                          (entry) => entry.selector === box.selector,
                        )?.height as number
                      }
                      onValue={(height) =>
                        setHeight(box.selector, height ?? 'auto')
                      }
                    />
                  </div>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};

/**
 * The part of each card that glows while the anime is on the user's list, and the room the score needs: the space
 * between the cards, which the glow needs so it doesn't run into the next card, and the height of parts of the cards
 * too short for the score.
 */
export const HighlightPart: Component<
  CardPartProps & {
    page: SitePage;
    onPageChange: (changes: Partial<SitePage>) => void;
  }
> = (props) => {
  const editor = useEditor();
  const pickInCard = createCardPicker(() => props.elements());
  const boxes = createFixedBoxes(
    () => props.elements(),
    () => props.card.selector,
  );
  const poster = createMemo(() => {
    editor.pageVersion();

    return posterSelector(props.elements()[0]);
  });
  const glow = () => glowOf(props.card, poster());
  const spacing = createMemo(() => {
    editor.pageVersion();

    return spacingOf(props.page, props.elements());
  });
  const gap = () => spacing()?.entry?.gap ?? spacing()?.site.space ?? 0;
  const setShimmer = (shimmer: SiteCard['shimmer']) =>
    props.onChange({ ...props.card, shimmer });

  async function pickOther() {
    const picked = await pickInCard();

    if (picked) setShimmer({ selector: picked.selector || undefined });
  }

  function choose(choice: string) {
    if (choice === 'poster') setShimmer({ selector: poster() });
    if (choice === 'card') setShimmer({});
    if (choice === 'other') void pickOther();
    if (choice === 'none') setShimmer(undefined);
  }

  // Spaces the cards the way the site does, so the change takes
  function setGap(value: number | undefined) {
    const { entry, selector, site } = spacing()!;
    const others = (props.page.layout ?? []).filter(
      (layout) => layout !== entry,
    );
    const method = entry?.spacing ?? site.method;
    const changed: Layout = {
      ...entry,
      container: selector,
      mode: entry?.mode ?? site.mode,
      ...(method !== 'gap' && { spacing: method }),
      gap: value,
    };
    const keep = changed.gap != null || changed.minCardWidth != null;

    props.onPageChange({
      layout:
        keep || others.length
          ? [...others, ...(keep ? [changed] : [])]
          : undefined,
    });
  }

  // As if the first two anime were on the user's list
  createEffect(() =>
    onCleanup(
      editor.mark({
        glow: props.card.shimmer
          ? props
              .elements()
              .slice(0, 2)
              .flatMap((element) => {
                const target = props.card.shimmer!.selector
                  ? element.querySelector(props.card.shimmer!.selector)
                  : element;

                return target ? [target] : [];
              })
          : [],
      }),
    ),
  );

  return (
    <>
      <ChoiceGroup label="What glows" value={glow()} onChange={choose}>
        <Show when={poster()}>
          <Choice value="poster" label="The poster" />
        </Show>
        <Choice value="card" label="The whole card" />
        <Choice
          value="other"
          label="Another part"
          description={
            glow() === 'other'
              ? props.card.shimmer!.selector
              : 'Click it on the page'
          }
        />
        <Choice value="none" label="Don't highlight" />
      </ChoiceGroup>
      <Show when={glow() !== 'none'}>
        <p class="m-0 text-[13px] text-muted-foreground">
          In this preview, the first two cards glow.
        </p>
      </Show>
      <Show when={spacing()}>
        <div class="flex flex-col gap-2 border-t border-t-solid border-border pt-4">
          <Range
            label="Space between cards"
            min={0}
            max={60}
            step={2}
            value={gap()}
            valueText={
              spacing()!.entry?.gap == null
                ? `Site's own, ${gap()} px`
                : `${gap()} px`
            }
            onValue={setGap}
          />
          <p class="m-0 text-[13px] leading-normal text-muted-foreground">
            {glow() === 'none'
              ? 'Add space if the score makes the cards look cramped.'
              : 'If the glow runs into the next card, add space until it stands alone.'}{' '}
            The site spaces its cards with{' '}
            {methodNames[spacing()!.entry?.spacing ?? spacing()!.site.method]},
            so that's what changes.
          </p>
          <Show when={spacing()!.entry?.gap != null}>
            <UiButton
              variant="link"
              size="inline"
              class="self-start px-0 text-violet-400"
              onClick={() => setGap(undefined)}
            >
              Use the site's spacing
            </UiButton>
          </Show>
        </div>
      </Show>
      <HeightsSection
        boxes={boxes()}
        page={props.page}
        onPageChange={props.onPageChange}
      />
      <Show when={props.advanced}>
        <Advanced>
          <Field
            label="Glowing element"
            hint="Inside the card; empty means the card itself"
          >
            <TextInput
              placeholder="The card itself"
              value={props.card.shimmer?.selector ?? ''}
              onValue={(selector) =>
                setShimmer({ selector: selector || undefined })
              }
            />
          </Field>
          <LayoutFields
            page={props.page}
            onChange={(layout) => props.onPageChange({ layout })}
          />
        </Advanced>
      </Show>
    </>
  );
};
