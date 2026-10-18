import type { Component, JSX } from 'solid-js';
import {
  createMemo,
  createSignal,
  createUniqueId,
  For,
  Match,
  Show,
  Switch,
} from 'solid-js';
import LucideCheck from '~icons/lucide/check';
import LucideChevronDown from '~icons/lucide/chevron-down';
import LucideEllipsis from '~icons/lucide/ellipsis';
import LucideMoon from '~icons/lucide/moon';
import LucidePanelBottom from '~icons/lucide/panel-bottom';
import LucideSparkles from '~icons/lucide/sparkles';
import LucideTriangleAlert from '~icons/lucide/triangle-alert';

import { Button } from '~/components/ui/button';
import type { SiteCard, SiteConfig, SitePage } from '~/sites/schema';
import { parseSiteConfig } from '~/sites/schema';
import { cn } from '~/utils';

import { cardElements, looksDark } from '../logic/detect';
import { newCard, newPage } from '../logic/draft';
import { copyConfig, downloadConfig, shareConfig } from '../logic/exportConfig';
import { useEditor } from './context';
import { Select, Warning } from './controls';
import { Dialog } from './Dialog';
import type { Position } from './Panel';
import { Panel } from './Panel';
import { CardsPart, cardsSummary } from './parts/CardsPart';
import { ColorsPart, themeSummary } from './parts/ColorsPart';
import { EpisodePart, episodeSummary } from './parts/EpisodePart';
import { HighlightPart, highlightSummary } from './parts/HighlightPart';
import { NamePart, nameSummary } from './parts/NamePart';
import { PagesPart, pagesSummary, safelyMatches } from './parts/PagesPart';
import { PlacementPart, placementSummary } from './parts/PlacementPart';
import type { Summary } from './parts/types';

type SectionId =
  'cards' | 'name' | 'episode' | 'placement' | 'colors' | 'highlight' | 'pages';

const groups: { title: string; sections: SectionId[] }[] = [
  { title: 'What AniScore reads', sections: ['cards', 'name', 'episode'] },
  { title: 'How it looks', sections: ['placement', 'colors', 'highlight'] },
  { title: 'Where it works', sections: ['pages'] },
];

const titles: Record<SectionId, string> = {
  cards: 'Episode cards',
  name: 'Name',
  episode: 'Episode and season',
  placement: 'Score position',
  colors: 'Colors',
  highlight: 'Highlight and spacing',
  pages: 'Pages and addresses',
};

const icons: Partial<Record<SectionId, () => JSX.Element>> = {
  placement: () => <LucidePanelBottom />,
  colors: () => <LucideMoon />,
  highlight: () => <LucideSparkles />,
};

const statusLabels: Partial<Record<Summary['status'], string>> = {
  ok: 'Works',
  issue: 'Needs a look',
};

const StatusIcon: Component<{ id: SectionId; status: Summary['status'] }> = (
  props,
) => (
  <span
    class="flex size-4.5 shrink-0 [&>svg]:size-full"
    role={statusLabels[props.status] ? 'img' : undefined}
    aria-label={statusLabels[props.status]}
    aria-hidden={statusLabels[props.status] ? undefined : true}
  >
    <Switch fallback={icons[props.id]?.()}>
      <Match when={props.status === 'ok'}>
        <LucideCheck class="text-violet-400" />
      </Match>
      <Match when={props.status === 'issue'}>
        <LucideTriangleAlert class="text-amber-500" />
      </Match>
    </Switch>
  </span>
);

export interface ChecklistProps {
  config: SiteConfig;
  onChange: (config: SiteConfig) => void;
  /**
   * Whether the config differs from the saved one.
   */
  dirty: boolean;
  subtitle: string;
  onSave: (config: SiteConfig) => Promise<void>;
  onDiscard: () => void;
  onStartOver: () => void;
  /**
   * Deletes the user's saved config; only for one they saved.
   */
  onDelete?: () => Promise<void>;
  onClose: () => void;
  position: Position | undefined;
  onMove: (position: Position) => void;
}

/**
 * Changes a setup: the guided setup's steps as a checklist, each with what it reads now, one open at a time. The
 * settings behind each (selectors, expressions, CSS) are under its "Advanced".
 */
export const Checklist: Component<ChecklistProps> = (props) => {
  const editor = useEditor();
  const [pageIndex, setPageIndex] = createSignal(
    // Starts on the page the user is on
    // eslint-disable-next-line solid/reactivity
    Math.max(0, props.config.pages.findIndex(safelyMatches)),
  );
  const [cardIndex, setCardIndex] = createSignal(0);
  const [open, setOpen] = createSignal<SectionId>();
  const [menu, setMenu] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [notice, setNotice] = createSignal('');
  const [error, setError] = createSignal('');
  const [saved, setSaved] = createSignal(false);
  const menuId = createUniqueId();

  const page = () =>
    props.config.pages[Math.min(pageIndex(), props.config.pages.length - 1)];
  const card = () =>
    page().cards[Math.min(cardIndex(), page().cards.length - 1)];
  const elements = createMemo(() => {
    editor.pageVersion();

    return cardElements(card());
  });
  const detected = createMemo(() =>
    looksDark(elements()[0] ?? document.body) ? 'dark' : 'light',
  );

  const change = (config: SiteConfig) => {
    setSaved(false);
    setError('');
    props.onChange(config);
  };
  const changePage = (changes: Partial<SitePage>) =>
    change({
      ...props.config,
      pages: props.config.pages.map((item) =>
        item === page() ? { ...item, ...changes } : item,
      ),
    });
  const changeCard = (changed: SiteCard) =>
    changePage({
      cards: page().cards.map((item) => (item === card() ? changed : item)),
    });

  const summaries = createMemo((): Record<SectionId, Summary> => {
    editor.pageVersion();

    return {
      cards: cardsSummary(elements()),
      name: nameSummary(card(), elements()),
      episode: episodeSummary(card(), elements()),
      placement: placementSummary(card(), elements()),
      colors: themeSummary(props.config.theme),
      highlight: highlightSummary(card(), page(), elements()),
      pages: pagesSummary(page()),
    };
  });

  function selectPage(value: string) {
    if (value === 'add') {
      change({
        ...props.config,
        pages: [...props.config.pages, newPage(location.pathname)],
      });
      setPageIndex(props.config.pages.length - 1);
      setCardIndex(0);
      setOpen('cards');

      return;
    }

    setPageIndex(Number(value));
    setCardIndex(0);
  }

  function addCard() {
    changePage({ cards: [...page().cards, newCard()] });
    setCardIndex(page().cards.length - 1);
    setOpen('cards');
  }

  function removeCard() {
    changePage({ cards: page().cards.filter((item) => item !== card()) });
    setCardIndex(0);
  }

  function removePage() {
    change({
      ...props.config,
      pages: props.config.pages.filter((item) => item !== page()),
    });
    setPageIndex(0);
    setCardIndex(0);
  }

  async function save() {
    const result = parseSiteConfig(props.config);

    if (!result.success) {
      setError(result.error);

      return;
    }

    await props.onSave(result.config);
    setSaved(true);
  }

  async function run(action: (config: SiteConfig) => string | Promise<string>) {
    setMenu(false);
    setNotice(await action(props.config));
  }

  const status = () =>
    props.dirty
      ? 'Unsaved changes, shown on the page'
      : saved()
        ? 'Saved'
        : 'No changes';

  const cardProps = () => ({
    card: card(),
    onChange: changeCard,
    elements,
    advanced: true,
  });

  const section = (id: SectionId) => (
    <Switch>
      <Match when={id === 'cards'}>
        <CardsPart {...cardProps()} />
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={addCard}>
            Add another kind of card
          </Button>
          <Show when={page().cards.length > 1}>
            <Button variant="ghost" size="sm" onClick={removeCard}>
              Remove this kind of card
            </Button>
          </Show>
        </div>
      </Match>
      <Match when={id === 'name'}>
        <NamePart {...cardProps()} />
      </Match>
      <Match when={id === 'episode'}>
        <EpisodePart {...cardProps()} />
      </Match>
      <Match when={id === 'placement'}>
        <PlacementPart {...cardProps()} />
      </Match>
      <Match when={id === 'colors'}>
        <ColorsPart
          config={props.config}
          onChange={(changes) => change({ ...props.config, ...changes })}
          page={page()}
          onPageChange={changePage}
          detected={detected()}
          probe={elements()[0]}
          advanced
        />
      </Match>
      <Match when={id === 'highlight'}>
        <HighlightPart
          {...cardProps()}
          page={page()}
          onPageChange={changePage}
        />
      </Match>
      <Match when={id === 'pages'}>
        <PagesPart
          config={props.config}
          onChange={(changes) => change({ ...props.config, ...changes })}
          page={page()}
          onPageChange={changePage}
          advanced
        />
        <Show when={props.config.pages.length > 1}>
          <Button
            variant="ghost"
            size="sm"
            class="self-start"
            onClick={removePage}
          >
            Remove this page
          </Button>
        </Show>
      </Match>
    </Switch>
  );

  return (
    <>
      <Panel
        label="AniScore editor"
        title={location.hostname}
        subtitle={props.subtitle}
        position={props.position}
        onMove={props.onMove}
        onClose={props.onClose}
        actions={
          <div
            class="relative"
            onFocusOut={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setMenu(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setMenu(false);
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              class="size-8 text-muted-foreground"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menu()}
              aria-controls={menuId}
              onClick={() => setMenu((value) => !value)}
            >
              <LucideEllipsis aria-hidden="true" />
            </Button>
            <Show when={menu()}>
              <div
                id={menuId}
                role="menu"
                class="absolute right-0 top-10 z-10 flex w-56 flex-col rounded-lg border border-solid border-border bg-background p-1 shadow-xl"
              >
                <For
                  each={[
                    {
                      label: 'Start from scratch',
                      action: () => {
                        setMenu(false);
                        props.onStartOver();
                      },
                    },
                    {
                      label: 'Share with everyone',
                      action: () => void run(shareConfig),
                    },
                    {
                      label: 'Copy the setup',
                      action: () => void run(copyConfig),
                    },
                    {
                      label: 'Download the setup file',
                      action: () => void run(downloadConfig),
                    },
                  ]}
                >
                  {(item) => (
                    <Button
                      role="menuitem"
                      variant="ghost"
                      size="sm"
                      class="justify-start text-sm font-normal"
                      onClick={item.action}
                    >
                      {item.label}
                    </Button>
                  )}
                </For>
                <Show when={props.onDelete}>
                  <Button
                    role="menuitem"
                    variant="ghost"
                    size="sm"
                    class="justify-start text-sm font-normal text-red-600 dark:text-red-400"
                    onClick={() => {
                      setMenu(false);
                      setDeleting(true);
                    }}
                  >
                    Delete this setup
                  </Button>
                </Show>
              </div>
            </Show>
          </div>
        }
        footer={
          <>
            <span
              class="flex-1 text-[13px] text-muted-foreground"
              role="status"
            >
              {status()}
            </span>
            <Show when={props.dirty}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => props.onDiscard()}
              >
                Discard
              </Button>
            </Show>
            <Button
              size="sm"
              disabled={!props.dirty}
              onClick={() => void save()}
            >
              Save
            </Button>
          </>
        }
      >
        <div class="-mx-5 -mt-5 flex flex-col gap-2 border-b border-b-solid border-border px-4 py-2.5">
          <div class="flex items-center gap-2.5">
            <label
              for={`${menuId}-page`}
              class="w-10 text-[13px] text-muted-foreground"
            >
              Page
            </label>
            <Select
              id={`${menuId}-page`}
              class="h-8 text-[13px]"
              value={String(pageIndex())}
              options={[
                ...props.config.pages.map((item, index) => ({
                  value: String(index),
                  label: `${item.name || `Page ${index + 1}`}${safelyMatches(item) ? ' (this page)' : ''}`,
                })),
                { value: 'add', label: 'Add a page' },
              ]}
              onValue={selectPage}
            />
          </div>
          <Show when={page().cards.length > 1}>
            <div class="flex items-center gap-2.5">
              <label
                for={`${menuId}-card`}
                class="w-10 text-[13px] text-muted-foreground"
              >
                Cards
              </label>
              <Select
                id={`${menuId}-card`}
                class="h-8 text-[13px]"
                value={String(cardIndex())}
                options={page().cards.map((_, index) => ({
                  value: String(index),
                  label: `Kind of card ${index + 1}`,
                }))}
                onValue={(value) => setCardIndex(Number(value))}
              />
            </div>
          </Show>
        </div>
        <div class="-mx-3 flex flex-col gap-1">
          <For each={groups}>
            {(group) => (
              <section class="flex flex-col gap-1 pt-2 first:pt-0">
                <h2 class="m-0 px-2 pb-1 text-xs font-semibold text-muted-foreground">
                  {group.title}
                </h2>
                <For each={group.sections}>
                  {(id) => {
                    const contentId = `${menuId}-${id}`;

                    return (
                      <>
                        <button
                          type="button"
                          class="flex w-full cursor-pointer items-center gap-3 rounded-lg border-none px-3 py-2.5 text-left text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                          classList={{
                            'bg-muted/60': open() === id,
                            'bg-transparent': open() !== id,
                          }}
                          aria-expanded={open() === id}
                          aria-controls={contentId}
                          onClick={() =>
                            setOpen((current) =>
                              current === id ? undefined : id,
                            )
                          }
                        >
                          <StatusIcon id={id} status={summaries()[id].status} />
                          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span class="text-sm font-semibold">
                              {titles[id]}
                            </span>
                            <span
                              class="truncate text-[13px]"
                              classList={{
                                'text-amber-700 dark:text-amber-200':
                                  summaries()[id].status === 'issue',
                                'text-muted-foreground':
                                  summaries()[id].status !== 'issue',
                              }}
                            >
                              {summaries()[id].text}
                            </span>
                          </span>
                          <LucideChevronDown
                            class={cn(
                              'size-4 shrink-0 text-muted-foreground transition-transform',
                              open() === id && 'rotate-180',
                            )}
                            aria-hidden="true"
                          />
                        </button>
                        <Show when={open() === id}>
                          <div
                            id={contentId}
                            class="flex flex-col gap-3 pb-3 pl-10.5 pr-3 pt-1"
                          >
                            {section(id)}
                          </div>
                        </Show>
                      </>
                    );
                  }}
                </For>
              </section>
            )}
          </For>
        </div>
        <Show when={error()}>
          <Warning>
            <span class="whitespace-pre-wrap">Can't save yet: {error()}</span>
          </Warning>
        </Show>
        <Show when={notice()}>
          <p class="m-0 text-[13px] text-muted-foreground" role="status">
            {notice()}
          </p>
        </Show>
      </Panel>
      <Show when={deleting()}>
        <Dialog
          title={`Delete your setup for ${location.hostname}?`}
          description="AniScore stops using it on this site. If AniScore comes with a setup for the site, that one is used again."
          onCancel={() => setDeleting(false)}
        >
          <div class="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleting(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void props.onDelete!()}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      </Show>
    </>
  );
};
