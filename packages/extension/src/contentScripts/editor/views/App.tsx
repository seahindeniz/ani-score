import { debounce } from '@solid-primitives/scheduled';
import type { Component } from 'solid-js';
import {
  createEffect,
  createSignal,
  Match,
  on,
  onCleanup,
  Switch,
} from 'solid-js';

import type { SiteConfig } from '~/sites/schema';

import { newDraft } from '../logic/draft';
import { createHighlight } from '../logic/highlight';
import { pickElement } from '../logic/picker';
import { createPreview } from '../logic/preview';
import { AlreadySetUp } from './AlreadySetUp';
import { Checklist } from './Checklist';
import type { EditorContextValue } from './context';
import { EditorContext } from './context';
import type { Position } from './Panel';
import { Setup, setupSteps } from './Setup';

/**
 * Work in progress, kept so closing the editor or leaving the page doesn't lose it. `step` is where the guided setup
 * was; a draft without one was made in the editor.
 */
export interface Draft {
  config: SiteConfig;
  step?: number;
}

export interface ExistingSetup {
  config: SiteConfig;
  /**
   * The user's own config, or the one AniScore comes with.
   */
  source: 'yours' | 'built-in';
  savedAt?: number;
}

export interface AppProps {
  /**
   * The config the page already has.
   */
  existing?: ExistingSetup;
  draft?: Draft;
  /**
   * The element the editor is rendered in, which picking ignores.
   */
  host: HTMLElement;
  onDraft: (draft: Draft | undefined) => void;
  onSave: (config: SiteConfig) => Promise<void>;
  /**
   * Deletes the user's config with this id.
   */
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

type Mode = 'ask' | 'setup' | 'editor';

const same = (a: SiteConfig | undefined, b: SiteConfig | undefined) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * The site editor on the page: asks first on a site that already has a setup, then runs the guided setup or the
 * editor, and shows AniScore's details on the page for the config being made all along.
 */
export const App: Component<AppProps> = (props) => {
  // The props are the editor's starting point, read once
  /* eslint-disable solid/reactivity */
  const [existing, setExisting] = createSignal(props.existing);
  // A new setup keeps the existing one's id, so saving it replaces that one
  const fresh = (): SiteConfig => {
    const config = existing()?.config;
    const draft = newDraft(location);

    return config
      ? { ...draft, id: config.id, name: config.name, matches: config.matches }
      : draft;
  };
  const [mode, setMode] = createSignal<Mode>(
    props.draft
      ? props.draft.step == null
        ? 'editor'
        : 'setup'
      : props.existing
        ? 'ask'
        : 'setup',
  );
  const [config, setConfig] = createSignal<SiteConfig>(
    props.draft?.config ?? props.existing?.config ?? fresh(),
  );
  const [step, setStep] = createSignal(props.draft?.step ?? 0);
  /* eslint-enable solid/reactivity */
  const [picking, setPicking] = createSignal(false);
  const [pageVersion, setPageVersion] = createSignal(0);
  const [position, setPosition] = createSignal<Position>();
  const preview = createPreview();
  const highlight = createHighlight();
  // The draft waiting to be written: changes come quickly, so they're written once they pause, and right away when the
  // editor closes or the page goes, so the last change isn't lost
  let pendingDraft: { draft: Draft | undefined } | undefined;
  const writeDraft = debounce(() => flushDraft(), 500);

  function saveDraft(draft: Draft | undefined) {
    pendingDraft = { draft };
    writeDraft();
  }

  function flushDraft() {
    writeDraft.clear();

    if (!pendingDraft) return;

    props.onDraft(pendingDraft.draft);
    pendingDraft = undefined;
  }

  // Saving writes the setup itself, and drops the draft
  function dropDraft() {
    writeDraft.clear();
    pendingDraft = undefined;
  }

  window.addEventListener('pagehide', flushDraft);
  // The editor and AniScore's details, also from inside their shadow roots
  const isOwn = (element: Element): boolean => {
    const root = element.getRootNode();

    if (root instanceof ShadowRoot) return isOwn(root.host);

    return (
      props.host.contains(element) || element.closest(`.${__NAME__}`) != null
    );
  };
  const dirty = () => !same(config(), existing()?.config);
  let marks: symbol | undefined;

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
    picking,
    async pick(options) {
      setPicking(true);

      try {
        return await pickElement({ ...options, ignore: isOwn });
      } finally {
        setPicking(false);
      }
    },
    point: highlight.point,
    mark(shown) {
      const token = Symbol('marks');

      marks = token;
      highlight.show(shown);

      return () => {
        if (marks === token) highlight.show({});
      };
    },
  };

  // The guided setup shows the details once there's a name and an episode to look up
  const previewing = () =>
    mode() !== 'setup'
    || step() >= setupSteps.findIndex(({ id }) => id === 'placement');

  createEffect(() => {
    if (previewing()) preview.update(config());
    else preview.dispose();
  });

  createEffect(
    on(
      [config, step, mode],
      ([current, at, shown]) => {
        if (shown === 'ask') return;

        // Once saved, there's nothing to keep
        saveDraft(
          dirty()
            ? { config: current, ...(shown === 'setup' && { step: at }) }
            : undefined,
        );
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    pageObserver.disconnect();
    window.removeEventListener('pagehide', flushDraft);
    flushDraft();
    preview.dispose();
    highlight.dispose();
  });

  async function save(saved: SiteConfig) {
    dropDraft();
    await props.onSave(saved);
    setExisting({ config: saved, source: 'yours', savedAt: Date.now() });
    setConfig(saved);
  }

  function startOver() {
    setConfig(fresh());
    setStep(0);
    setMode('setup');
  }

  function discard() {
    const saved = existing();

    if (saved) setConfig(saved.config);
    else startOver();
  }

  const subtitle = () => {
    const saved = existing();

    if (!saved) return 'Not saved yet';
    if (saved.source === 'built-in') return "AniScore's built-in setup";

    return saved.savedAt
      ? `Your setup, saved ${new Date(saved.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`
      : 'Your setup';
  };

  return (
    <EditorContext.Provider value={context}>
      <Switch>
        <Match when={mode() === 'ask'}>
          <AlreadySetUp
            host={location.hostname}
            source={existing()!.source}
            savedAt={existing()!.savedAt}
            onEdit={() => setMode('editor')}
            onStartOver={startOver}
            onCancel={() => props.onClose()}
          />
        </Match>
        <Match when={mode() === 'setup'}>
          <Setup
            config={config()}
            onChange={setConfig}
            step={step()}
            onStep={setStep}
            onSave={save}
            onOpenEditor={() => setMode('editor')}
            onClose={() => props.onClose()}
            position={position()}
            onMove={setPosition}
          />
        </Match>
        <Match when={mode() === 'editor'}>
          <Checklist
            config={config()}
            onChange={setConfig}
            dirty={dirty()}
            subtitle={subtitle()}
            onSave={save}
            onDiscard={discard}
            onStartOver={startOver}
            onDelete={
              existing()?.source === 'yours'
                ? async () => {
                    await props.onDelete(existing()!.config.id);
                    props.onClose();
                  }
                : undefined
            }
            onClose={() => props.onClose()}
            position={position()}
            onMove={setPosition}
          />
        </Match>
      </Switch>
    </EditorContext.Provider>
  );
};
