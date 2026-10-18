import type { Component } from 'solid-js';
import { Show } from 'solid-js';

import type { Condition, SiteConfig } from '~/sites/schema';

import { elementSelector } from '../logic/selectors';
import { useEditor } from './context';
import {
  Button,
  Field,
  Section,
  Select,
  TextArea,
  TextInput,
} from './controls';

type ThemeKind = 'system' | 'dark' | 'light' | 'selector' | 'localStorage';

const themeOptions: { value: ThemeKind; label: string }[] = [
  { value: 'system', label: "The user's setting" },
  { value: 'dark', label: 'Always dark' },
  { value: 'light', label: 'Always light' },
  { value: 'selector', label: 'Dark while an element matches' },
  { value: 'localStorage', label: 'Dark while the site stores a value' },
];

function themeKind(theme: SiteConfig['theme']): ThemeKind {
  if (typeof theme !== 'object') return theme ?? 'system';

  return 'localStorage' in theme.dark ? 'localStorage' : 'selector';
}

const defaultTheme: Record<ThemeKind, SiteConfig['theme']> = {
  system: undefined,
  dark: 'dark',
  light: 'light',
  selector: { dark: { selector: 'html.dark' } },
  localStorage: { dark: { localStorage: { key: 'theme', equals: 'dark' } } },
};

/**
 * The site as a whole: its name, the addresses it covers, its theme and CSS.
 */
export const SiteTab: Component<{
  draft: SiteConfig;
  onChange: (changes: Partial<SiteConfig>) => void;
}> = (props) => {
  const editor = useEditor();
  const condition = (): Condition | undefined =>
    typeof props.draft.theme === 'object' ? props.draft.theme.dark : undefined;
  const darkSelector = () => {
    const dark = condition();

    return dark && 'selector' in dark ? dark : undefined;
  };
  const darkStorage = () => {
    const dark = condition();

    return dark && 'localStorage' in dark ? dark.localStorage : undefined;
  };

  async function unblock() {
    const element = await editor.pick();

    if (!element) return;

    props.onChange({
      css: [
        props.draft.css,
        `/* Lets clicks and hovers through to the cards */\n${elementSelector(element)} {\n  pointer-events: none !important;\n}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  return (
    <div class="flex flex-col gap-2">
      <Field label="Name">
        <TextInput
          value={props.draft.name}
          onValue={(name) => props.onChange({ name })}
        />
      </Field>
      <Field label="Id" hint="Lowercase letters, digits and dashes">
        <TextInput
          value={props.draft.id}
          onValue={(id) => props.onChange({ id })}
        />
      </Field>
      <Field
        label="Addresses"
        hint="One match pattern per line, e.g. *://example.com/*"
      >
        <TextArea
          value={props.draft.matches.join('\n')}
          onValue={(value) =>
            props.onChange({
              matches: value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
        />
      </Field>
      <Section title="Theme">
        <Select
          aria-label="Theme"
          value={themeKind(props.draft.theme)}
          options={themeOptions}
          onValue={(kind) => props.onChange({ theme: defaultTheme[kind] })}
        />
        <Show when={darkSelector()}>
          {(dark) => (
            <Field label="Element" hint="e.g. body.dark-mode">
              <TextInput
                value={dark().selector}
                onValue={(selector) =>
                  props.onChange({ theme: { dark: { selector } } })
                }
              />
            </Field>
          )}
        </Show>
        <Show when={darkStorage()}>
          {(stored) => (
            <div class="grid grid-cols-2 gap-1">
              <Field label="Key">
                <TextInput
                  value={stored().key}
                  onValue={(key) =>
                    props.onChange({
                      theme: { dark: { localStorage: { ...stored(), key } } },
                    })
                  }
                />
              </Field>
              <Field label="Dark value">
                <TextInput
                  value={stored().equals}
                  onValue={(equals) =>
                    props.onChange({
                      theme: {
                        dark: { localStorage: { ...stored(), equals } },
                      },
                    })
                  }
                />
              </Field>
            </div>
          )}
        </Show>
      </Section>
      <Field
        label="Site CSS"
        hint="Applied on every page of the site that has cards"
      >
        <TextArea
          value={props.draft.css ?? ''}
          onValue={(css) => props.onChange({ css: css || undefined })}
        />
      </Field>
      <div>
        <Button onClick={unblock}>Pick an overlay that blocks the cards</Button>
      </div>
    </div>
  );
};
