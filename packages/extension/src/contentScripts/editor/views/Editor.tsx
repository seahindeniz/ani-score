import { debounce } from '@solid-primitives/scheduled';
import type { Component } from 'solid-js';
import {
  createEffect,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  Show,
  Switch,
} from 'solid-js';

import { pageMatches } from '~/contentScripts/sites/extract';
import type { SiteConfig } from '~/sites/schema';

import { createHighlight } from '../logic/highlight';
import { pickElement } from '../logic/picker';
import { createPreview } from '../logic/preview';
import type { EditorContextValue } from './context';
import { EditorContext } from './context';
import { Button } from './controls';
import { PagesTab } from './PagesTab';
import { ReviewTab } from './ReviewTab';
import { SiteTab } from './SiteTab';

type Tab = 'site' | 'pages' | 'review';

const tabs: { id: Tab; label: string }[] = [
  { id: 'site', label: 'Site' },
  { id: 'pages', label: 'Pages' },
  { id: 'review', label: 'Save' },
];

export interface EditorProps {
  initial: SiteConfig;
  /**
   * The element the editor is rendered in, which picking ignores.
   */
  host: HTMLElement;
  onDraft: (draft: SiteConfig) => void;
  onSave: (config: SiteConfig) => Promise<void>;
  /**
   * The config to start over from: the saved one, or a new one.
   */
  onStartOver: () => Promise<SiteConfig>;
  onClose: () => void;
}

const safelyMatches = (page: SiteConfig['pages'][number]) => {
  try {
    return pageMatches(page, location);
  } catch {
    return false;
  }
};

/**
 * Builds a site config on the page itself: pick the cards and what to read from them, and see AniScore's details on
 * the page while editing.
 */
export const Editor: Component<EditorProps> = (props) => {
  const [draft, setDraft] = createSignal<SiteConfig>(props.initial);
  const [tab, setTab] = createSignal<Tab>('pages');
  const [picking, setPicking] = createSignal(false);
  const [minimized, setMinimized] = createSignal(false);
  const [livePreview, setLivePreview] = createSignal(true);
  const [pageVersion, setPageVersion] = createSignal(0);
  const [position, setPosition] = createSignal<{ x: number; y: number }>();
  const preview = createPreview();
  const highlight = createHighlight();
  // The callbacks and the host are fixed for the editor's life, not reactive values
  // eslint-disable-next-line solid/reactivity
  const saveDraft = debounce((value: SiteConfig) => props.onDraft(value), 500);
  const isOwn = (element: Element) =>
    props.host.contains(element) || element.closest(`.${__NAME__}`) != null;

  // What the editor reads from the page is read again after the site changes it
  const pageObserver = new MutationObserver(
    // eslint-disable-next-line solid/reactivity -- reads the host, see above
    debounce((records: MutationRecord[]) => {
      // A text change's target is the text node
      const changed = (record: MutationRecord) =>
        record.target instanceof Element
          ? record.target
          : record.target.parentElement;

      if (
        records.some((record) => {
          const element = changed(record);

          return element != null && !isOwn(element);
        })
      ) {
        setPageVersion((version) => version + 1);
      }
    }, 300),
  );

  pageObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const context: EditorContextValue = {
    pageVersion,
    async pick(options) {
      setPicking(true);

      try {
        return await pickElement({ ...options, ignore: isOwn });
      } finally {
        setPicking(false);
      }
    },
  };

  const change = (changes: Partial<SiteConfig>) =>
    setDraft((current) => ({ ...current, ...changes }));

  createEffect(on(draft, (value) => saveDraft(value), { defer: true }));
  createEffect(() => {
    if (livePreview()) preview.update(draft());
    else preview.dispose();
  });
  createEffect(() =>
    highlight.show(
      draft()
        .pages.filter(safelyMatches)
        .flatMap((page) => page.cards.map((card) => card.selector)),
    ),
  );

  onCleanup(() => {
    pageObserver.disconnect();
    saveDraft.clear();
    preview.dispose();
    highlight.dispose();
  });

  async function startOver() {
    setDraft(await props.onStartOver());
  }

  // Moves the panel by its header
  function drag(event: PointerEvent) {
    const panel = (event.currentTarget as HTMLElement).parentElement!;
    const start = panel.getBoundingClientRect();
    const offset = {
      x: event.clientX - start.left,
      y: event.clientY - start.top,
    };
    const move = (moveEvent: PointerEvent) =>
      setPosition({
        x: Math.max(0, moveEvent.clientX - offset.x),
        y: Math.max(0, moveEvent.clientY - offset.y),
      });
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  return (
    <EditorContext.Provider value={context}>
      <div
        role="dialog"
        aria-label="AniScore site editor"
        class="fixed z-[2147483647] flex max-h-[85vh] w-[380px] flex-col overflow-hidden rounded-lg border border-solid border-border bg-background text-foreground shadow-xl"
        style={
          position()
            ? { left: `${position()!.x}px`, top: `${position()!.y}px` }
            : { right: '16px', bottom: '16px' }
        }
      >
        <header
          class="flex cursor-move select-none items-center justify-between gap-2 border-b border-b-solid border-border px-3 py-2"
          onPointerDown={drag}
        >
          <strong class="text-sm">
            AniScore · {draft().name || 'New site'}
          </strong>
          <div class="flex gap-1">
            <Button
              aria-label={minimized() ? 'Expand' : 'Minimize'}
              onClick={() => setMinimized((value) => !value)}
            >
              {minimized() ? '▢' : '_'}
            </Button>
            <Button aria-label="Close" onClick={() => props.onClose()}>
              ✕
            </Button>
          </div>
        </header>
        <Show when={picking()}>
          <p
            class="m-0 bg-primary px-3 py-1 text-xs text-primary-foreground"
            role="status"
          >
            Click an element on the page. Esc cancels.
          </p>
        </Show>
        <Show when={!minimized()}>
          <nav class="flex gap-1 px-3 pt-2" role="tablist">
            <For each={tabs}>
              {(item) => (
                <Button
                  role="tab"
                  aria-selected={tab() === item.id}
                  variant={tab() === item.id ? 'primary' : 'secondary'}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </Button>
              )}
            </For>
          </nav>
          <div class="flex flex-col gap-2 overflow-y-auto px-3 py-2">
            <Switch>
              <Match when={tab() === 'site'}>
                <SiteTab draft={draft()} onChange={change} />
              </Match>
              <Match when={tab() === 'pages'}>
                <PagesTab
                  pages={draft().pages}
                  onChange={(pages) => change({ pages })}
                />
              </Match>
              <Match when={tab() === 'review'}>
                <ReviewTab draft={draft()} onSave={props.onSave} />
              </Match>
            </Switch>
          </div>
          <footer class="flex items-center justify-between gap-2 border-t border-t-solid border-border px-3 py-2 text-xs">
            <label class="flex items-center gap-1">
              <input
                type="checkbox"
                checked={livePreview()}
                onChange={(event) =>
                  setLivePreview(event.currentTarget.checked)
                }
              />
              Live preview
            </label>
            <Button onClick={() => void startOver()}>Start over</Button>
          </footer>
        </Show>
      </div>
    </EditorContext.Provider>
  );
};
