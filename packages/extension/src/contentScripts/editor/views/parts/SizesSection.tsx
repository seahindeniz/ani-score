import type { Component } from 'solid-js';
import { createMemo, For, onCleanup, Show } from 'solid-js';

import type { SitePage } from '~/sites/schema';

import type { Box } from '../../logic/spacing';
import { cutsOff } from '../../logic/spacing';
import { useEditor } from '../context';
import { NumberInput, Select, Warning } from '../controls';
import { cardCount } from './types';

type Size = NonNullable<SitePage['sizes']>[number];

type Dimension = 'height' | 'width';

const words = {
  height: {
    label: 'Height',
    site: "The site's height",
    lifted: 'Fit the content',
    custom: 'Set a height',
  },
  width: {
    label: 'Width',
    site: "The site's width",
    lifted: 'No limit',
    custom: 'Set a width',
  },
};

const SizeRow: Component<{
  selector: string;
  dimension: Dimension;
  /**
   * The element's size now, which a size set by hand starts from.
   */
  current: number;
  value: Size[Dimension];
  onChange: (value: Size[Dimension]) => void;
}> = (props) => {
  const text = () => words[props.dimension];
  const choice = () =>
    props.value === undefined
      ? 'site'
      : props.value === 'auto'
        ? 'auto'
        : 'custom';

  return (
    <div class="flex items-center gap-2">
      <span class="w-12 shrink-0 text-xs text-muted-foreground">
        {text().label}
      </span>
      <Select
        aria-label={`${text().label} of ${props.selector}`}
        class="h-8 flex-1"
        value={choice()}
        options={[
          { value: 'site', label: text().site },
          { value: 'auto', label: text().lifted },
          { value: 'custom', label: text().custom },
        ]}
        onValue={(chosen) =>
          props.onChange(
            chosen === 'site'
              ? undefined
              : chosen === 'auto'
                ? 'auto'
                : props.current + 40,
          )
        }
      />
      <Show when={choice() === 'custom'}>
        <div class="w-20 shrink-0">
          <NumberInput
            aria-label={`${text().label} of ${props.selector} in pixels`}
            value={props.value as number}
            onValue={(value) => props.onChange(value ?? 'auto')}
          />
        </div>
      </Show>
    </div>
  );
};

interface Listed extends Box {
  /**
   * Whether it's around the details on this page now, rather than only set before.
   */
  seen: boolean;
}

const pixels = (value: Size[Dimension]) =>
  typeof value === 'number' ? value : 0;

/**
 * The elements from the score up to the whole card, each with its height and width: the site's, without its limit,
 * or set here. Those too small for the score are marked, and pointing at one outlines it on the page.
 */
export const SizesSection: Component<{
  boxes: Box[];
  page: SitePage;
  onPageChange: (changes: Partial<SitePage>) => void;
}> = (props) => {
  const editor = useEditor();
  const sizes = () => props.page.sizes ?? [];
  const sizeOf = (selector: string) =>
    sizes().find((entry) => entry.selector === selector);
  const listed = createMemo(
    (): Listed[] => [
      ...props.boxes.map((box) => ({ ...box, seen: true })),
      ...sizes()
        .filter(
          (entry) =>
            !props.boxes.some((box) => box.selector === entry.selector),
        )
        .map((entry) => ({
          selector: entry.selector,
          height: pixels(entry.height),
          width: pixels(entry.width),
          short: 0,
          narrow: 0,
          seen: false,
        })),
    ],
    [],
    // Drawn again only when they change, which would close an open dropdown
    { equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  const cut = () => props.boxes.filter(cutsOff);

  function setSize(
    selector: string,
    dimension: Dimension,
    value: Size[Dimension],
  ) {
    const entry: Size = { ...sizeOf(selector), selector, [dimension]: value };

    if (value === undefined) delete entry[dimension];

    const others = sizes().filter((item) => item.selector !== selector);
    const list =
      entry.height === undefined && entry.width === undefined
        ? others
        : [...others, entry];

    props.onPageChange({ sizes: list.length ? list : undefined });
  }

  function point(selector: string) {
    try {
      editor.point(Array.from(document.querySelectorAll(selector)));
    } catch {
      // A selector being typed under Advanced
      editor.point([]);
    }
  }

  onCleanup(() => editor.point([]));

  const status = (box: Listed) => {
    if (!box.seen) return 'Not around the score on this page';

    const problems = [
      box.short && `too short on ${cardCount(box.short)}`,
      box.narrow && `too narrow on ${cardCount(box.narrow)}`,
    ].filter(Boolean);

    return `${box.width} × ${box.height} px${problems.length ? `, ${problems.join(', ')}` : ''}`;
  };

  return (
    <Show when={listed().length}>
      <section
        aria-label="Room for the score"
        class="flex flex-col gap-3 border-t border-t-solid border-border pt-4"
      >
        <div class="flex flex-col gap-1">
          <h3 class="m-0 text-sm font-semibold">Room for the score</h3>
          <p class="m-0 text-[13px] leading-normal text-muted-foreground">
            The parts of the card around the score, from the closest to the
            whole card. Point at one to see it on the page.
          </p>
        </div>
        <Show when={cut().length}>
          <Warning>
            {cut().length === 1
              ? 'One part of the cards is'
              : `${cut().length} parts of the cards are`}{' '}
            too small for the score, so it's cut off or runs over. Lift their
            limit, or give them another size.
          </Warning>
        </Show>
        <For each={listed()}>
          {(box) => (
            <div
              class="flex flex-col gap-2 rounded-lg border border-solid p-3 transition-colors hover:border-violet-400"
              classList={{
                'border-amber-500/60': cutsOff(box),
                'border-border': !cutsOff(box),
              }}
              onMouseEnter={() => point(box.selector)}
              onMouseLeave={() => editor.point([])}
              onFocusIn={() => point(box.selector)}
              onFocusOut={() => editor.point([])}
            >
              <code class="break-all text-xs">{box.selector}</code>
              <span
                class="text-xs"
                classList={{
                  'text-amber-700 dark:text-amber-200': cutsOff(box),
                  'text-muted-foreground': !cutsOff(box),
                }}
              >
                {status(box)}
              </span>
              <For each={['height', 'width'] as const}>
                {(dimension) => (
                  <SizeRow
                    selector={box.selector}
                    dimension={dimension}
                    current={box[dimension]}
                    value={sizeOf(box.selector)?.[dimension]}
                    onChange={(value) =>
                      setSize(box.selector, dimension, value)
                    }
                  />
                )}
              </For>
            </div>
          )}
        </For>
      </section>
    </Show>
  );
};
