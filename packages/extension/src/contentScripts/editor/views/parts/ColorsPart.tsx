import type { Component } from 'solid-js';
import { createSignal, onCleanup, Show } from 'solid-js';

import { Button as UiButton } from '~/components/ui/button';
import { Choice, ChoiceGroup } from '~/components/ui/choice-group';
import type { Condition, SiteConfig } from '~/sites/schema';

import { describeCondition, learnThemeSwitch } from '../../logic/themeSwitch';
import { Advanced, Field, TextInput } from '../controls';
import type { Summary } from './types';

type Theme = SiteConfig['theme'];

type ThemeChoice = 'dark' | 'light' | 'switch' | 'system';

const choiceOf = (theme: Theme): ThemeChoice =>
  typeof theme === 'object' ? 'switch' : (theme ?? 'system');

export const themeSummary = (theme: Theme): Summary => ({
  text: {
    dark: 'Dark',
    light: 'Light',
    switch: "Follows the site's switch",
    system: 'Like your browser',
  }[choiceOf(theme)],
  status: 'none',
});

const ConditionFields: Component<{
  condition: Condition;
  onChange: (condition: Condition) => void;
}> = (props) => (
  <>
    <Show when={'selector' in props.condition && props.condition}>
      {(condition) => (
        <Field label="Dark while this matches" hint="e.g. body.dark-mode">
          <TextInput
            value={condition().selector}
            onValue={(selector) => props.onChange({ selector })}
          />
        </Field>
      )}
    </Show>
    <Show
      when={'localStorage' in props.condition && props.condition.localStorage}
    >
      {(stored) => (
        <div class="grid grid-cols-2 gap-1">
          <Field label="Stored key">
            <TextInput
              value={stored().key}
              onValue={(key) =>
                props.onChange({ localStorage: { ...stored(), key } })
              }
            />
          </Field>
          <Field label="Dark value">
            <TextInput
              value={stored().equals}
              onValue={(equals) =>
                props.onChange({ localStorage: { ...stored(), equals } })
              }
            />
          </Field>
        </div>
      )}
    </Show>
  </>
);

/**
 * Whether the details use dark or light colors, or follow the site's own switch.
 */
export const ColorsPart: Component<{
  config: SiteConfig;
  onChange: (changes: Partial<SiteConfig>) => void;
  /**
   * The colors the page has, from where its cards are.
   */
  detected: 'dark' | 'light';
  /**
   * Where the page's darkness is checked while learning its switch.
   */
  probe?: Element;
  advanced?: boolean;
}> = (props) => {
  const [learning, setLearning] = createSignal(false);
  let stop: (() => void) | undefined;

  function learn() {
    stop?.();
    setLearning(true);
    // Called from the click that chose the switch, so it isn't a tracked scope
    // eslint-disable-next-line solid/reactivity
    stop = learnThemeSwitch((dark) => {
      setLearning(false);
      props.onChange({ theme: { dark } });
    }, props.probe);
  }

  function stopLearning() {
    stop?.();
    setLearning(false);
  }

  onCleanup(() => stop?.());

  function choose(choice: string) {
    stopLearning();

    if (choice === 'switch') {
      if (typeof props.config.theme !== 'object') learn();

      return;
    }

    props.onChange({
      theme: choice === 'system' ? undefined : (choice as 'dark' | 'light'),
    });
  }

  const learned = () =>
    typeof props.config.theme === 'object'
      ? props.config.theme.dark
      : undefined;
  const detectedNote = (choice: 'dark' | 'light') =>
    props.detected === choice ? 'Detected' : undefined;

  return (
    <>
      <ChoiceGroup
        label="Score colors"
        value={learning() ? 'switch' : choiceOf(props.config.theme)}
        onChange={choose}
      >
        <Choice value="dark" label="Dark" description={detectedNote('dark')} />
        <Choice
          value="light"
          label="Light"
          description={detectedNote('light')}
        />
        <Choice
          value="switch"
          label="Follow the site's light and dark switch"
          description={
            learned()
              ? `Dark while ${describeCondition(learned()!)}`
              : "Flip the site's switch once, and AniScore learns which mode is which"
          }
        />
        <Show when={choiceOf(props.config.theme) === 'system'}>
          <Choice value="system" label="Like your browser" />
        </Show>
      </ChoiceGroup>
      <Show when={learning()}>
        <p class="m-0 text-[13px] text-muted-foreground" role="status">
          Now flip the site's light and dark switch. AniScore is watching.
        </p>
      </Show>
      <Show when={learned() && !learning()}>
        <UiButton
          variant="link"
          size="inline"
          class="self-start px-0 text-violet-400"
          onClick={learn}
        >
          Learn the switch again
        </UiButton>
      </Show>
      <Show when={props.advanced && learned()}>
        {(condition) => (
          <Advanced>
            <ConditionFields
              condition={condition()}
              onChange={(dark) => props.onChange({ theme: { dark } })}
            />
          </Advanced>
        )}
      </Show>
    </>
  );
};
