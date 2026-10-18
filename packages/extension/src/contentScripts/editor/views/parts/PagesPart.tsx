import type { Component } from 'solid-js';
import { createMemo, For, Index, Show } from 'solid-js';
import LucideX from '~icons/lucide/x';

import { Button as UiButton } from '~/components/ui/button';
import { Choice, ChoiceGroup } from '~/components/ui/choice-group';
import { pageMatches } from '~/contentScripts/sites/extract';
import type { SiteConfig, SitePage } from '~/sites/schema';

import { elementSelector, suggestPathPattern } from '../../logic/selectors';
import { useEditor } from '../context';
import {
  Advanced,
  Button,
  Field,
  TextArea,
  TextInput,
  Warning,
} from '../controls';
import { createPicker } from './pick';
import type { Summary } from './types';

type Scope = 'some' | 'every';

/**
 * The page's path patterns; a page can apply on several.
 */
export const pathsOf = (page: SitePage) =>
  page.match.path === undefined ? [] : [page.match.path].flat();

const scopeOf = (page: SitePage): Scope =>
  pathsOf(page).length || page.match.search || page.match.selector
    ? 'some'
    : 'every';

// Literal characters, escaped ones and `\d+`: what `suggestPathPattern` writes
const plainPattern = /^\^?(?:\\d\+|\\.|[^\\[\]()*+?{}|^$.])*\$?$/;

/**
 * A path pattern as an address, `#` standing for any number (`^/page/\d+/$` → `/page/#/`), or `undefined` when it's
 * more of an expression than that.
 */
export function describePath(pattern: string) {
  if (!plainPattern.test(pattern)) return undefined;

  return pattern
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replaceAll('\\d+', '#')
    .replace(/\\(.)/g, '$1');
}

const pathMatches = (pattern: string) => {
  try {
    return new RegExp(pattern).test(location.pathname);
  } catch {
    // An expression being typed
    return false;
  }
};

const addressOf = (pattern: string) => {
  const path = describePath(pattern);

  return path === undefined ? pattern : `${location.hostname}${path}`;
};

export function pagesSummary(page: SitePage): Summary {
  const paths = pathsOf(page);
  const status = safelyMatches(page) ? 'ok' : 'issue';

  if (scopeOf(page) === 'every') {
    return { text: `Every page on ${location.hostname}`, status };
  }

  if (!paths.length) {
    return {
      text: `Pages matching ${page.match.search ?? page.match.selector}`,
      status,
    };
  }

  return {
    text: `${addressOf(paths[0])}${paths.length > 1 ? ` and ${paths.length - 1} more` : ''}`,
    status,
  };
}

export function safelyMatches(page: SitePage) {
  try {
    return pageMatches(page, location);
  } catch {
    // An expression being typed
    return false;
  }
}

/**
 * Which pages of the site get scores: every page, or the addresses listed (any of them), and in the advanced settings
 * the patterns themselves, the site's name and its addresses.
 */
export const PagesPart: Component<{
  /**
   * The site, whose name and addresses the advanced settings edit.
   */
  config?: SiteConfig;
  onChange?: (changes: Partial<SiteConfig>) => void;
  page: SitePage;
  onPageChange: (changes: Partial<SitePage>) => void;
  advanced?: boolean;
}> = (props) => {
  const editor = useEditor();
  const pick = createPicker();
  const applies = createMemo(() => {
    editor.pageVersion();

    return safelyMatches(props.page);
  });
  const scope = () => scopeOf(props.page);
  const paths = () => pathsOf(props.page);
  const thisPage = () => suggestPathPattern(location.pathname);
  const setMatch = (changes: Partial<SitePage['match']>) =>
    props.onPageChange({ match: { ...props.page.match, ...changes } });
  // One pattern is kept as a string, like before lists
  const setPaths = (list: string[]) =>
    setMatch({
      path: list.length > 1 ? list : list.length ? list[0] : undefined,
    });

  async function pickRequiredElement() {
    const element = await pick();

    if (element) setMatch({ selector: elementSelector(element) });
  }

  return (
    <>
      <ChoiceGroup
        label="Show scores on"
        showLabel={!props.advanced}
        value={scope()}
        onChange={(choice) =>
          props.onPageChange({
            match: choice === 'some' ? { path: thisPage() } : {},
          })
        }
      >
        <Choice
          value="some"
          label="Some pages"
          description="The addresses below, any of them"
        />
        <Choice
          value="every"
          label={`Every page on ${location.hostname}`}
          description="Wherever cards like these appear"
        />
      </ChoiceGroup>
      <Show when={scope() === 'some' && paths().length}>
        <ul
          aria-label="Addresses"
          class="m-0 flex list-none flex-col gap-2 p-0"
        >
          <For each={paths()}>
            {(pattern, index) => (
              <li class="flex items-center gap-2 rounded-lg border border-solid border-border py-1.5 pl-3 pr-1.5">
                <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    class="break-all text-sm"
                    classList={{ 'font-mono': !describePath(pattern) }}
                  >
                    {addressOf(pattern)}
                  </span>
                  <Show when={pathMatches(pattern)}>
                    <span class="text-xs text-violet-400">
                      Includes this page
                    </span>
                  </Show>
                </span>
                <Show when={paths().length > 1}>
                  <UiButton
                    variant="ghost"
                    size="icon"
                    class="size-8 shrink-0 text-muted-foreground"
                    aria-label={`Remove ${addressOf(pattern)}`}
                    onClick={() =>
                      setPaths(paths().filter((_, at) => at !== index()))
                    }
                  >
                    <LucideX aria-hidden="true" />
                  </UiButton>
                </Show>
              </li>
            )}
          </For>
        </ul>
        <Show
          when={paths().some((pattern) => describePath(pattern)?.includes('#'))}
        >
          <p class="m-0 text-xs text-muted-foreground">
            # stands for any number.
          </p>
        </Show>
        <Show when={!paths().some(pathMatches)}>
          <UiButton
            variant="outline"
            size="sm"
            class="self-start"
            onClick={() => setPaths([...paths(), thisPage()])}
          >
            Add this page
          </UiButton>
        </Show>
      </Show>
      <Show when={!applies()}>
        <Warning>
          These pages don't include the one you're on, so AniScore shows nothing
          here.
        </Warning>
      </Show>
      <Show when={props.advanced}>
        <Advanced>
          <Field label="Page name" hint="Tells the pages apart in this editor">
            <TextInput
              value={props.page.name ?? ''}
              placeholder="e.g. Latest episodes"
              onValue={(name) =>
                props.onPageChange({ name: name || undefined })
              }
            />
          </Field>
          <div class="flex flex-col gap-1 text-xs">
            <span class="font-medium">Paths</span>
            <Index each={paths()}>
              {(pattern, index) => (
                <div class="flex gap-1">
                  <TextInput
                    aria-label={`Path ${index + 1}`}
                    value={pattern()}
                    onValue={(value) =>
                      setPaths(
                        paths()
                          .map((item, at) => (at === index ? value : item))
                          .filter(Boolean),
                      )
                    }
                  />
                  <Button
                    aria-label={`Remove path ${index + 1}`}
                    onClick={() =>
                      setPaths(paths().filter((_, at) => at !== index))
                    }
                  >
                    ✕
                  </Button>
                </div>
              )}
            </Index>
            <Button
              class="self-start"
              onClick={() => setPaths([...paths(), thisPage()])}
            >
              Add a path
            </Button>
            <span class="text-[11px] text-muted-foreground">
              Regular expressions for the address' path, any of which applies;
              \d+ stands for any number
            </span>
          </div>
          <Field label="Query" hint="Tested against ?…">
            <TextInput
              value={props.page.match.search ?? ''}
              onValue={(search) => setMatch({ search: search || undefined })}
            />
          </Field>
          <Field
            label="Only while this exists"
            hint="For apps that keep the address"
          >
            <div class="flex gap-1">
              <TextInput
                value={props.page.match.selector ?? ''}
                onValue={(selector) =>
                  setMatch({ selector: selector || undefined })
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
          <Show when={props.config}>
            {(site) => (
              <>
                <Field label="Site name" hint="Shown in the side panel">
                  <TextInput
                    value={site().name}
                    onValue={(name) => props.onChange?.({ name })}
                  />
                </Field>
                <Field
                  label="Addresses"
                  hint="One match pattern per line, e.g. *://example.com/*. Add the site's other domains here."
                >
                  <TextArea
                    value={site().matches.join('\n')}
                    onValue={(value) =>
                      props.onChange?.({
                        matches: value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="Id" hint="Lowercase letters, digits and dashes">
                  <TextInput
                    value={site().id}
                    onValue={(id) => props.onChange?.({ id })}
                  />
                </Field>
              </>
            )}
          </Show>
        </Advanced>
      </Show>
    </>
  );
};
