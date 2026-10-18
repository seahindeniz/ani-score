import type { Component, JSX } from 'solid-js';
import {
  createMemo,
  createSignal,
  For,
  Index,
  Match,
  Show,
  Switch,
} from 'solid-js';
import LucideCheck from '~icons/lucide/check';

import { Button } from '~/components/ui/button';
import type { SiteCard, SiteConfig, SitePage } from '~/sites/schema';
import { parseSiteConfig } from '~/sites/schema';

import { cardElements, firstExtract, looksDark } from '../logic/detect';
import { shareConfig } from '../logic/exportConfig';
import { useEditor } from './context';
import { Warning } from './controls';
import type { Position } from './Panel';
import { Panel } from './Panel';
import { CardsPart, cardsSummary } from './parts/CardsPart';
import { ColorsPart, themeSummary } from './parts/ColorsPart';
import { EpisodePart, episodeSummary } from './parts/EpisodePart';
import { HighlightPart, highlightSummary } from './parts/HighlightPart';
import { isUnset, NamePart, nameSummary } from './parts/NamePart';
import { PagesPart } from './parts/PagesPart';
import { PlacementPart, placementSummary } from './parts/PlacementPart';
import type { Summary } from './parts/types';

type StepId =
  | 'cards'
  | 'name'
  | 'episode'
  | 'placement'
  | 'colors'
  | 'highlight'
  | 'review';

interface Step {
  id: StepId;
  title: string;
  description: string;
  optional?: boolean;
}

export const setupSteps: Step[] = [
  {
    id: 'cards',
    title: 'Find the episode cards',
    description:
      'Click any episode on the page. AniScore finds the others that look like it.',
  },
  {
    id: 'name',
    title: "Pick the anime's name",
    description:
      'Click the name inside any outlined card. AniScore uses it to find the anime on AniList.',
  },
  {
    id: 'episode',
    title: 'Pick the episode number',
    description:
      'Click the episode text in any card. AniScore keeps only the number, so the score matches the right season.',
  },
  {
    id: 'placement',
    title: 'Choose where the score goes',
    description:
      "The cards on the page show the result. Pick the spot where it doesn't cover anything.",
  },
  {
    id: 'colors',
    title: "Match the site's colors",
    description: 'The score uses dark or light colors.',
    optional: true,
  },
  {
    id: 'highlight',
    title: 'Highlight anime on your list',
    description:
      'When an anime is on your AniList list, part of its card can glow. Choose which part, and give it room.',
    optional: true,
  },
  {
    id: 'review',
    title: 'Check and save',
    description: 'Change anything that looks wrong.',
  },
];

export interface SetupProps {
  config: SiteConfig;
  onChange: (config: SiteConfig) => void;
  /**
   * The index of the step on show, kept with the draft so the setup goes on where it was left.
   */
  step: number;
  onStep: (step: number) => void;
  onSave: (config: SiteConfig) => Promise<void>;
  onOpenEditor: () => void;
  onClose: () => void;
  position: Position | undefined;
  onMove: (position: Position) => void;
}

/**
 * Sets a site up one step at a time: each step asks for one thing, mostly a click on the page, and shows the result on
 * the page right away. It sets up the page the user is on, with one kind of card; the editor adds more.
 */
export const Setup: Component<SetupProps> = (props) => {
  const editor = useEditor();
  const [saved, setSaved] = createSignal(false);
  const [error, setError] = createSignal('');
  const [notice, setNotice] = createSignal('');
  const [placed, setPlaced] = createSignal(false);
  const page = () => props.config.pages[0];
  const card = () => page().cards[0];
  const elements = createMemo(() => {
    editor.pageVersion();

    return cardElements(card());
  });
  const detected = createMemo(() =>
    looksDark(elements()[0] ?? document.body) ? 'dark' : 'light',
  );
  const step = () => setupSteps[props.step];

  const changePage = (changes: Partial<SitePage>, config = props.config) =>
    ({
      ...config,
      pages: config.pages.map((item, index) =>
        index === 0 ? { ...item, ...changes } : item,
      ),
    }) satisfies SiteConfig;
  const changeCard = (changed: SiteCard, config = props.config) =>
    changePage(
      {
        cards: config.pages[0].cards.map((item, index) =>
          index === 0 ? changed : item,
        ),
      },
      config,
    );

  // Whether the step has what it asks for; the optional and the later ones always do
  function done() {
    switch (step().id) {
      case 'cards':
        return elements().length > 0;
      case 'name':
        return !isUnset(card().title);
      case 'episode':
        return card().episode !== undefined;
      default:
        return true;
    }
  }

  // Moves to a step, filling in what it suggests the first time: the score under the name, the colors the page has
  function go(index: number) {
    let config = props.config;
    const id = setupSteps[index].id;
    const name = firstExtract(card().title)?.selector;

    if (
      id === 'placement'
      && !placed()
      && name
      && !card().inject.selector
      && card().inject.position === 'append'
    ) {
      config = changeCard(
        { ...card(), inject: { selector: name, position: 'after' } },
        config,
      );
    }

    if (step().id === 'placement') setPlaced(true);

    if (index >= setupSteps.findIndex((item) => item.id === 'colors')) {
      config =
        config.theme === undefined ? { ...config, theme: detected() } : config;
    }

    if (config !== props.config) props.onChange(config);

    setError('');
    props.onStep(index);
  }

  function skip() {
    if (step().id === 'episode') {
      props.onChange(
        changeCard({
          ...card(),
          episode: undefined,
          season: undefined,
          allowMissingEpisode: undefined,
        }),
      );
    }

    if (step().id === 'highlight') {
      props.onChange(
        changePage(
          { layout: undefined },
          changeCard({ ...card(), shimmer: undefined }),
        ),
      );
    }

    go(props.step + 1);
  }

  const skipLabel = () =>
    step().id === 'episode' && !card().episode
      ? 'No episodes here'
      : step().optional
        ? 'Skip'
        : undefined;

  async function save() {
    const result = parseSiteConfig(props.config);

    if (!result.success) {
      setError(result.error);

      return;
    }

    await props.onSave(result.config);
    setSaved(true);
  }

  const summaries = (): { label: string; step: StepId; summary: Summary }[] => [
    {
      label: 'Episode cards',
      step: 'cards',
      summary: cardsSummary(elements()),
    },
    { label: 'Name', step: 'name', summary: nameSummary(card(), elements()) },
    {
      label: 'Episode',
      step: 'episode',
      summary: episodeSummary(card(), elements()),
    },
    {
      label: 'Score',
      step: 'placement',
      summary: placementSummary(card(), elements()),
    },
    {
      label: 'Colors',
      step: 'colors',
      summary: themeSummary(props.config.theme),
    },
    {
      label: 'Highlight and spacing',
      step: 'highlight',
      summary: highlightSummary(card(), page(), elements()),
    },
  ];
  const reviewSummaries = createMemo(() => {
    editor.pageVersion();

    return summaries();
  });

  const cardProps = () => ({
    card: card(),
    onChange: (changed: SiteCard) => props.onChange(changeCard(changed)),
    elements,
    autoPick: true,
  });

  const description = (): JSX.Element =>
    step().id === 'colors'
      ? `The score uses dark or light colors. AniScore picked ${detected()} because this site looks ${detected()}.`
      : step().id === 'review'
          && reviewSummaries().every(
            ({ summary }) => summary.status !== 'issue',
          )
        ? 'Everything reads correctly. Change anything that looks wrong.'
        : step().description;

  return (
    <Panel
      label="AniScore setup"
      title={`Set up ${location.hostname}`}
      position={props.position}
      onMove={props.onMove}
      onClose={props.onClose}
      top={
        <Show when={!saved()}>
          <div class="flex flex-col gap-2.5 px-5 pt-4">
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>
                Step {props.step + 1} of {setupSteps.length}
              </span>
              <Show when={step().optional}>
                <span>Optional</span>
              </Show>
            </div>
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={1}
              aria-valuemax={setupSteps.length}
              aria-valuenow={props.step + 1}
              class="grid grid-cols-7 gap-1"
            >
              <Index each={setupSteps}>
                {(_, index) => (
                  <span
                    class="h-1 rounded-full"
                    classList={{
                      'bg-violet-500': index <= props.step,
                      'bg-muted': index > props.step,
                    }}
                  />
                )}
              </Index>
            </div>
          </div>
        </Show>
      }
      footer={
        <Show
          when={!saved()}
          fallback={
            <Button class="ml-auto" size="sm" onClick={() => props.onClose()}>
              Done
            </Button>
          }
        >
          <Show when={props.step > 0}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => go(props.step - 1)}
            >
              Back
            </Button>
          </Show>
          <span class="flex-1" />
          <Show when={skipLabel()}>
            <Button
              variant="ghost"
              size="sm"
              class="text-muted-foreground"
              onClick={skip}
            >
              {skipLabel()}
            </Button>
          </Show>
          <Show
            when={step().id !== 'review'}
            fallback={
              <Button size="sm" onClick={() => void save()}>
                Save
              </Button>
            }
          >
            <Button
              size="sm"
              disabled={!done()}
              onClick={() => go(props.step + 1)}
            >
              Next
            </Button>
          </Show>
        </Show>
      }
    >
      <Show
        when={!saved()}
        fallback={
          <div class="flex flex-col items-start gap-3.5 pt-4">
            <span class="flex size-11 items-center justify-center rounded-full bg-violet-500/20">
              <LucideCheck
                class="size-5.5 text-violet-400"
                aria-hidden="true"
              />
            </span>
            <h1 class="m-0 text-xl font-semibold" aria-live="polite">
              {location.hostname} is set up
            </h1>
            <p class="m-0 text-sm leading-relaxed text-muted-foreground">
              Scores show on this site from now on. Share the setup so other
              AniScore users get it in an update, too.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void shareConfig(props.config).then(setNotice)}
            >
              Share with everyone
            </Button>
            <Show when={notice()}>
              <p class="m-0 text-[13px] text-muted-foreground" role="status">
                {notice()}
              </p>
            </Show>
            <p class="m-0 mt-2 text-[13px] leading-normal text-muted-foreground">
              To add another page or kind of card, open the editor.
            </p>
            <Button
              variant="link"
              size="inline"
              class="px-0 text-violet-400"
              onClick={() => props.onOpenEditor()}
            >
              Open the editor
            </Button>
          </div>
        }
      >
        <div class="flex flex-col gap-1.5">
          <h1 class="m-0 text-xl font-semibold">{step().title}</h1>
          <p class="m-0 text-sm leading-relaxed text-muted-foreground">
            {description()}
          </p>
        </div>
        <Switch>
          <Match when={step().id === 'cards'}>
            <CardsPart {...cardProps()} />
          </Match>
          <Match when={step().id === 'name'}>
            <NamePart {...cardProps()} />
          </Match>
          <Match when={step().id === 'episode'}>
            <EpisodePart {...cardProps()} />
          </Match>
          <Match when={step().id === 'placement'}>
            <PlacementPart {...cardProps()} />
          </Match>
          <Match when={step().id === 'colors'}>
            <ColorsPart
              config={props.config}
              onChange={(changes) =>
                props.onChange({ ...props.config, ...changes })
              }
              detected={detected()}
              probe={elements()[0]}
            />
          </Match>
          <Match when={step().id === 'highlight'}>
            <HighlightPart
              {...cardProps()}
              page={page()}
              onPageChange={(changes) => props.onChange(changePage(changes))}
            />
          </Match>
          <Match when={step().id === 'review'}>
            <dl class="m-0 flex flex-col rounded-lg border border-solid border-border">
              <For each={reviewSummaries()}>
                {(row, index) => (
                  <div
                    class="flex items-center gap-3 px-3.5 py-2"
                    classList={{
                      'border-t border-t-solid border-border': index() > 0,
                    }}
                  >
                    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <dt class="text-xs text-muted-foreground">{row.label}</dt>
                      <dd
                        class="m-0 text-sm"
                        classList={{
                          'text-amber-700 dark:text-amber-200':
                            row.summary.status === 'issue',
                        }}
                      >
                        {row.summary.text}
                      </dd>
                    </div>
                    <Button
                      variant="link"
                      size="inline"
                      class="px-1 text-violet-400"
                      aria-label={`Change ${row.label.toLowerCase()}`}
                      onClick={() =>
                        go(setupSteps.findIndex((item) => item.id === row.step))
                      }
                    >
                      Change
                    </Button>
                  </div>
                )}
              </For>
            </dl>
            <PagesPart
              page={page()}
              onPageChange={(changes) => props.onChange(changePage(changes))}
            />
            <Show when={error()}>
              <Warning>
                <span class="whitespace-pre-wrap">
                  Can't save yet: {error()}
                </span>
              </Warning>
            </Show>
          </Match>
        </Switch>
      </Show>
    </Panel>
  );
};
