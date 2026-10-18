import type { Component } from 'solid-js';
import { createMemo, createSignal, Index, Show } from 'solid-js';

import { pageMatches } from '~/contentScripts/sites/extract';
import type { SitePage } from '~/sites/schema';

import { newCard, newPage } from '../logic/draft';
import { elementSelector, suggestPathPattern } from '../logic/selectors';
import { CardEditor, cardElements } from './CardEditor';
import { useEditor } from './context';
import {
  Button,
  Field,
  NumberInput,
  Section,
  Select,
  TextArea,
  TextInput,
} from './controls';

type Layout = NonNullable<SitePage['layout']>[number];

const LayoutEditor: Component<{
  page: SitePage;
  onChange: (layout: Layout[] | undefined) => void;
}> = (props) => {
  const layout = () => props.page.layout ?? [];
  const set = (list: Layout[]) =>
    props.onChange(list.length ? list : undefined);

  // Starts from the element that holds the first cards, with the spacing anizm.net's cards got
  function add() {
    const container = props.page.cards.flatMap((card) => cardElements(card))[0]
      ?.parentElement;

    if (!container) return;

    const mode = getComputedStyle(container).display.includes('grid')
      ? 'grid'
      : 'flex';

    set([
      ...layout(),
      {
        container: elementSelector(container),
        mode,
        gap: 30,
        minCardWidth: mode === 'grid' ? 180 : 220,
      },
    ]);
  }

  return (
    <Section
      title="Spacing"
      actions={<Button onClick={add}>Add for the cards' container</Button>}
    >
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
                <Select
                  aria-label="Layout"
                  value={item().mode}
                  options={[
                    { value: 'grid', label: 'Grid' },
                    { value: 'flex', label: 'Row' },
                  ]}
                  onValue={(mode) => update({ mode })}
                />
                <Button
                  aria-label="Remove spacing"
                  onClick={() => set(layout().filter((_, at) => at !== index))}
                >
                  ✕
                </Button>
              </div>
              <div class="grid grid-cols-2 gap-1">
                <Field label="Gap (px)">
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
    </Section>
  );
};

/**
 * The pages with episode cards: which URLs they cover, and their cards.
 */
export const PagesTab: Component<{
  pages: SitePage[];
  onChange: (pages: SitePage[]) => void;
}> = (props) => {
  const editor = useEditor();
  const [selected, setSelected] = createSignal(0);
  const page = () => props.pages[Math.min(selected(), props.pages.length - 1)];
  const update = (changes: Partial<SitePage>) =>
    props.onChange(
      props.pages.map((item) =>
        item === page() ? { ...item, ...changes } : item,
      ),
    );
  const applies = createMemo(() => {
    editor.pageVersion();

    try {
      return pageMatches(page(), location);
    } catch {
      // An expression being typed
      return false;
    }
  });

  async function pickRequiredElement() {
    const element = await editor.pick();

    if (element) {
      update({
        match: { ...page().match, selector: elementSelector(element) },
      });
    }
  }

  return (
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap gap-1" role="tablist" aria-label="Pages">
        <Index each={props.pages}>
          {(item, index) => (
            <Button
              role="tab"
              aria-selected={page() === item()}
              variant={page() === item() ? 'primary' : 'secondary'}
              onClick={() => setSelected(index)}
            >
              {item().name || `Page ${index + 1}`}
            </Button>
          )}
        </Index>
        <Button
          onClick={() => {
            props.onChange([...props.pages, newPage(location.pathname)]);
            setSelected(props.pages.length);
          }}
        >
          + Page
        </Button>
      </div>
      <Show when={page()}>
        <Section
          title="Page"
          actions={
            <Show when={props.pages.length > 1}>
              <Button
                onClick={() => {
                  props.onChange(props.pages.filter((item) => item !== page()));
                  setSelected(0);
                }}
              >
                Remove page
              </Button>
            </Show>
          }
        >
          <Field label="Name">
            <TextInput
              value={page().name ?? ''}
              placeholder="e.g. Latest episodes"
              onValue={(name) => update({ name: name || undefined })}
            />
          </Field>
          <Field
            label="Path"
            hint="A regular expression for the address' path; \d+ stands for any number"
          >
            <div class="flex gap-1">
              <TextInput
                value={page().match.path ?? ''}
                onValue={(path) =>
                  update({
                    match: { ...page().match, path: path || undefined },
                  })
                }
              />
              <Button
                aria-label="Use this page's path"
                onClick={() =>
                  update({
                    match: {
                      ...page().match,
                      path: suggestPathPattern(location.pathname),
                    },
                  })
                }
              >
                This page
              </Button>
            </div>
          </Field>
          <span
            class="text-[11px]"
            classList={{ 'text-destructive': !applies() }}
            role="status"
          >
            {applies()
              ? 'Applies to the page you are on'
              : "Doesn't apply to the page you are on"}
          </span>
          <div class="grid grid-cols-2 gap-2">
            <Field label="Query" hint="Tested against ?…">
              <TextInput
                value={page().match.search ?? ''}
                onValue={(search) =>
                  update({
                    match: { ...page().match, search: search || undefined },
                  })
                }
              />
            </Field>
            <Field
              label="Only while this exists"
              hint="For apps that keep the address"
            >
              <div class="flex gap-1">
                <TextInput
                  value={page().match.selector ?? ''}
                  onValue={(selector) =>
                    update({
                      match: {
                        ...page().match,
                        selector: selector || undefined,
                      },
                    })
                  }
                />
                <Button
                  aria-label="Pick an element the page has"
                  onClick={() => void pickRequiredElement()}
                >
                  Pick
                </Button>
              </div>
            </Field>
          </div>
        </Section>
        <Index each={page().cards}>
          {(card, index) => (
            <CardEditor
              card={card()}
              index={index}
              onChange={(changed) =>
                update({
                  cards: page().cards.map((item, at) =>
                    at === index ? changed : item,
                  ),
                })
              }
              onRemove={
                page().cards.length > 1
                  ? () =>
                      update({
                        cards: page().cards.filter((_, at) => at !== index),
                      })
                  : undefined
              }
            />
          )}
        </Index>
        <div>
          <Button
            onClick={() => update({ cards: [...page().cards, newCard()] })}
          >
            + Card type
          </Button>
        </div>
        <LayoutEditor page={page()} onChange={(layout) => update({ layout })} />
        <Field label="Page CSS" hint="Applied while this page applies">
          <TextArea
            value={page().css ?? ''}
            onValue={(css) => update({ css: css || undefined })}
          />
        </Field>
      </Show>
    </div>
  );
};
