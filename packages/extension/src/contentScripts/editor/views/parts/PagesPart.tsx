import type { Component } from 'solid-js';
import { createMemo, Show } from 'solid-js';

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

type Scope = 'like' | 'every' | 'custom';

function scopeOf(page: SitePage): Scope {
  const { path, search, selector } = page.match;

  if (!path && !search && !selector) return 'every';

  return path === suggestPathPattern(location.pathname) && !search && !selector
    ? 'like'
    : 'custom';
}

export function pagesSummary(page: SitePage): Summary {
  const text = {
    like: `${location.hostname}${location.pathname} and similar`,
    every: `Every page on ${location.hostname}`,
    custom: `Pages matching ${page.match.path ?? page.match.search ?? page.match.selector}`,
  }[scopeOf(page)];

  return { text, status: safelyMatches(page) ? 'ok' : 'issue' };
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
 * Which pages of the site get scores, and in the advanced settings the site's name and addresses.
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
  const setMatch = (changes: Partial<SitePage['match']>) =>
    props.onPageChange({ match: { ...props.page.match, ...changes } });

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
            match:
              choice === 'like'
                ? { path: suggestPathPattern(location.pathname) }
                : {},
          })
        }
      >
        <Choice
          value="like"
          label="Pages like this one"
          description={`${location.hostname}${location.pathname} and similar addresses`}
        />
        <Choice
          value="every"
          label={`Every page on ${location.hostname}`}
          description="Wherever cards like these appear"
        />
        <Show when={scope() === 'custom'}>
          <Choice
            value="custom"
            label="Pages you set up"
            description={pagesSummary(props.page).text}
          />
        </Show>
      </ChoiceGroup>
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
          <Field
            label="Path"
            hint="A regular expression for the address' path; \d+ stands for any number"
          >
            <TextInput
              value={props.page.match.path ?? ''}
              onValue={(path) => setMatch({ path: path || undefined })}
            />
          </Field>
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
