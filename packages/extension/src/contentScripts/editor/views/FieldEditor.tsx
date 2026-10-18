import type { Component } from 'solid-js';
import { createMemo, For, Index, Show } from 'solid-js';

import { Dropdown } from '~/components/ui/dropdown';
import { readField } from '~/contentScripts/sites/extract';
import { presetNames } from '~/sites/presets';
import type { SiteExtract, SiteField, SiteStep } from '~/sites/schema';

import { relativeSelector } from '../logic/selectors';
import { describeStep, stepPresets } from '../logic/stepPresets';
import { useEditor } from './context';
import {
  Button,
  Field,
  NumberInput,
  Section,
  Select,
  TextInput,
} from './controls';

type SourceKind = 'text' | 'ownText' | 'attr';

const sourceOptions: { value: SourceKind; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'ownText', label: 'Own text (without child elements)' },
  { value: 'attr', label: 'Attribute' },
];

const kindOf = (source: SiteExtract['source']): SourceKind =>
  typeof source === 'object' ? 'attr' : (source ?? 'text');

type MatchStep = Extract<SiteStep, { match: string }>;
type ReplaceStep = Extract<SiteStep, { replace: string }>;
type PresetStep = Extract<SiteStep, { preset: string }>;

const asMatch = (step: SiteStep) => ('match' in step ? step : undefined);
const asReplace = (step: SiteStep) => ('replace' in step ? step : undefined);
const asPreset = (step: SiteStep) => ('preset' in step ? step : undefined);

const StepEditor: Component<{
  step: SiteStep;
  onChange: (step: SiteStep) => void;
  onRemove: () => void;
}> = (props) => (
  <li class="flex flex-col gap-1 rounded bg-secondary/50 p-1">
    <div class="flex items-center justify-between gap-1">
      <span class="break-all text-[11px]">{describeStep(props.step)}</span>
      <Button onClick={() => props.onRemove()} aria-label="Remove step">
        ✕
      </Button>
    </div>
    <Show when={asMatch(props.step)}>
      {(step: () => MatchStep) => (
        <div class="grid grid-cols-[1fr_3rem_3rem] gap-1">
          <TextInput
            aria-label="Expression"
            value={step().match}
            onValue={(match) => props.onChange({ ...step(), match })}
          />
          <TextInput
            aria-label="Flags"
            value={step().flags ?? ''}
            onValue={(flags) =>
              props.onChange({ ...step(), flags: flags || undefined })
            }
          />
          <NumberInput
            aria-label="Group"
            value={step().group}
            onValue={(group) => props.onChange({ ...step(), group })}
          />
        </div>
      )}
    </Show>
    <Show when={asReplace(props.step)}>
      {(step: () => ReplaceStep) => (
        <div class="grid grid-cols-[1fr_1fr_3rem] gap-1">
          <TextInput
            aria-label="Replace"
            value={step().replace}
            onValue={(replace) => props.onChange({ ...step(), replace })}
          />
          <TextInput
            aria-label="With"
            value={step().with}
            onValue={(value) => props.onChange({ ...step(), with: value })}
          />
          <TextInput
            aria-label="Flags"
            value={step().flags ?? ''}
            onValue={(flags) =>
              props.onChange({ ...step(), flags: flags || undefined })
            }
          />
        </div>
      )}
    </Show>
    <Show when={asPreset(props.step)}>
      {(step: () => PresetStep) => (
        <Select
          aria-label="Transform"
          value={step().preset}
          options={presetNames.map((name) => ({ value: name, label: name }))}
          onValue={(preset) => props.onChange({ preset })}
        />
      )}
    </Show>
  </li>
);

const customSteps: Record<string, SiteStep> = {
  'custom-match': { match: '(.+)' },
  'custom-replace': { replace: '', with: '' },
};

const ExtractEditor: Component<{
  extract: SiteExtract;
  onChange: (extract: SiteExtract) => void;
  onRemove?: () => void;
  cards: () => HTMLElement[];
}> = (props) => {
  const editor = useEditor();
  const steps = () => props.extract.steps ?? [];
  const setSteps = (list: SiteStep[]) =>
    props.onChange({ ...props.extract, steps: list.length ? list : undefined });

  async function pick() {
    const card = (element: Element) =>
      props.cards().find((item) => item.contains(element));
    const element = await editor.pick({
      resolve: (target) => (card(target) ? target : null),
    });

    if (!element) return;

    props.onChange({
      ...props.extract,
      selector: relativeSelector(card(element)!, element) || undefined,
    });
  }

  return (
    <div class="flex flex-col gap-2">
      <Field
        label="Element"
        hint="Inside the card; empty means the card itself"
      >
        <div class="flex gap-1">
          <TextInput
            placeholder="The card itself"
            value={props.extract.selector ?? ''}
            onValue={(selector) =>
              props.onChange({
                ...props.extract,
                selector: selector || undefined,
              })
            }
          />
          <Button aria-label="Pick the element" onClick={pick}>
            Pick
          </Button>
        </div>
      </Field>
      <div class="flex gap-1">
        <Select
          aria-label="Read"
          value={kindOf(props.extract.source)}
          options={sourceOptions}
          onValue={(kind) =>
            props.onChange({
              ...props.extract,
              source:
                kind === 'attr'
                  ? { attr: 'href' }
                  : kind === 'text'
                    ? undefined
                    : kind,
            })
          }
        />
        <Show
          when={
            typeof props.extract.source === 'object' && props.extract.source
          }
        >
          {(source) => (
            <TextInput
              aria-label="Attribute"
              value={source().attr}
              onValue={(attr) =>
                props.onChange({ ...props.extract, source: { attr } })
              }
            />
          )}
        </Show>
      </div>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <Index each={steps()}>
          {(step, index) => (
            <StepEditor
              step={step()}
              onChange={(changed) =>
                setSteps(
                  steps().map((item, at) => (at === index ? changed : item)),
                )
              }
              onRemove={() => setSteps(steps().filter((_, at) => at !== index))}
            />
          )}
        </Index>
      </ul>
      <div class="flex gap-1">
        <Dropdown
          aria-label="Add a step"
          class="flex-1"
          placeholder="Add a step…"
          value={undefined}
          options={[
            ...stepPresets.map((preset, index) => ({
              value: String(index),
              label: preset.label,
            })),
            { value: 'custom-match', label: 'Keep part of it (expression)' },
            { value: 'custom-replace', label: 'Replace part of it' },
          ]}
          onChange={(value) =>
            setSteps([
              ...steps(),
              ...(customSteps[value] !== undefined
                ? [customSteps[value]]
                : stepPresets[Number(value)].steps),
            ])
          }
        />
        <Show when={props.onRemove}>
          <Button onClick={() => props.onRemove!()}>Remove fallback</Button>
        </Show>
      </div>
    </div>
  );
};

/**
 * Edits how a value is read from each card, and shows what it reads from the first cards on the page.
 */
export const FieldEditor: Component<{
  label: string;
  field: SiteField | undefined;
  onChange: (field: SiteField | undefined) => void;
  cards: () => HTMLElement[];
  /**
   * Can be left out of the config, like the season.
   */
  optional?: boolean;
  /**
   * Read as a number, like the episode.
   */
  numeric?: boolean;
}> = (props) => {
  const editor = useEditor();
  const extracts = () =>
    props.field === undefined
      ? []
      : Array.isArray(props.field)
        ? props.field
        : [props.field];
  const setExtracts = (list: SiteExtract[]) =>
    props.onChange(list.length > 1 ? list : list[0]);
  const values = createMemo(() => {
    editor.pageVersion();

    const { field } = props;

    if (field === undefined) return [];

    return props
      .cards()
      .slice(0, 5)
      .map((card) => {
        const value = readField(card, field);

        if (!props.numeric) return value;

        const number = Number.parseInt(value);

        return Number.isNaN(number) ? '' : String(number);
      });
  });

  return (
    <Section
      title={props.label}
      actions={
        <Show when={props.optional}>
          <Show
            when={props.field !== undefined}
            fallback={
              <Button onClick={() => props.onChange({})}>Read it</Button>
            }
          >
            <Button onClick={() => props.onChange(undefined)}>
              Don't read
            </Button>
          </Show>
        </Show>
      }
    >
      <Show when={props.field !== undefined}>
        <Index each={extracts()}>
          {(extract, index) => (
            <ExtractEditor
              extract={extract()}
              cards={props.cards}
              onChange={(changed) =>
                setExtracts(
                  extracts().map((item, at) => (at === index ? changed : item)),
                )
              }
              onRemove={
                extracts().length > 1
                  ? () =>
                      setExtracts(extracts().filter((_, at) => at !== index))
                  : undefined
              }
            />
          )}
        </Index>
        <div>
          <Button onClick={() => setExtracts([...extracts(), {}])}>
            Add a fallback
          </Button>
        </div>
        <ol
          class="m-0 flex flex-col gap-0.5 pl-4 text-[11px]"
          aria-label={`${props.label} on the first cards`}
        >
          <For each={values()}>
            {(value) => (
              <li classList={{ 'text-destructive': !value }}>
                {value || 'Nothing read'}
              </li>
            )}
          </For>
        </ol>
      </Show>
    </Section>
  );
};
