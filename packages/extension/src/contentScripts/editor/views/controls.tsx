import clsx from 'clsx';
import type { JSX, ParentComponent } from 'solid-js';
import { createSignal, createUniqueId, For, Show, splitProps } from 'solid-js';
import LucideCheck from '~icons/lucide/check';
import LucideInfo from '~icons/lucide/info';
import LucideMousePointer2 from '~icons/lucide/mouse-pointer-2';
import LucideTriangleAlert from '~icons/lucide/triangle-alert';

import { Button as UiButton } from '~/components/ui/button';

import { useEditor } from './context';

const inputClass =
  'w-full min-w-0 rounded border border-solid border-input bg-transparent px-2 py-1 text-xs text-foreground';

export const Field: ParentComponent<{ label: string; hint?: string }> = (
  props,
) => (
  // A label around the control names it for screen readers and tests
  <label class="flex flex-col gap-1 text-xs">
    <span class="font-medium">{props.label}</span>
    {props.children}
    <Show when={props.hint}>
      <span class="text-[11px] text-muted-foreground">{props.hint}</span>
    </Show>
  </label>
);

export function TextInput(
  props: Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onInput'> & {
    onValue: (value: string) => void;
  },
) {
  const [local, others] = splitProps(props, ['onValue', 'class']);

  return (
    <input
      type="text"
      spellcheck={false}
      class={clsx(inputClass, 'font-mono', local.class)}
      onInput={(event) => local.onValue(event.currentTarget.value)}
      {...others}
    />
  );
}

export function NumberInput(props: {
  value: number | undefined;
  onValue: (value: number | undefined) => void;
  'aria-label'?: string;
}) {
  return (
    <input
      type="number"
      min="0"
      class={inputClass}
      aria-label={props['aria-label']}
      value={props.value ?? ''}
      onInput={(event) => {
        const { value } = event.currentTarget;

        props.onValue(value === '' ? undefined : Number(value));
      }}
    />
  );
}

export function TextArea(
  props: Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onInput'> & {
    onValue?: (value: string) => void;
  },
) {
  const [local, others] = splitProps(props, ['onValue', 'class']);

  return (
    <textarea
      spellcheck={false}
      class={clsx(inputClass, 'min-h-20 font-mono', local.class)}
      onInput={(event) => local.onValue?.(event.currentTarget.value)}
      {...others}
    />
  );
}

export function Select<Value extends string>(props: {
  value: Value;
  options: { value: Value; label: string }[];
  onValue: (value: Value) => void;
  'aria-label'?: string;
  id?: string;
  class?: string;
}) {
  return (
    <select
      id={props.id}
      class={clsx(inputClass, props.class)}
      aria-label={props['aria-label']}
      value={props.value}
      onChange={(event) => props.onValue(event.currentTarget.value as Value)}
    >
      <For each={props.options}>
        {(option) => <option value={option.value}>{option.label}</option>}
      </For>
    </select>
  );
}

/**
 * The editor's small buttons, for the advanced settings: the shared button at its dense size.
 */
export function Button(
  props: Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
    variant?: 'primary' | 'secondary';
  },
) {
  const [local, others] = splitProps(props, ['variant']);

  return (
    <UiButton
      size="xs"
      variant={local.variant === 'primary' ? 'default' : 'outline'}
      {...others}
    />
  );
}

/**
 * A titled group of controls.
 */
export const Section: ParentComponent<{
  title: string;
  actions?: JSX.Element;
}> = (props) => (
  <section class="flex flex-col gap-2 rounded border border-solid border-border p-2">
    <div class="flex items-center justify-between gap-2">
      <h3 class="m-0 text-xs font-semibold">{props.title}</h3>
      {props.actions}
    </div>
    {props.children}
  </section>
);

/**
 * Where a guided part waits for a click on the page: says what to click, and offers to pick again after Escape.
 */
export const Waiting: ParentComponent<{ onPick: () => void }> = (props) => {
  const editor = useEditor();

  return (
    <div class="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/50 p-4 text-sm text-muted-foreground">
      <LucideMousePointer2
        class="size-5 shrink-0 text-violet-400"
        aria-hidden="true"
      />
      <span class="flex-1">{props.children}</span>
      <Show when={!editor.picking()}>
        <UiButton size="sm" variant="outline" onClick={() => props.onPick()}>
          Pick on the page
        </UiButton>
      </Show>
    </div>
  );
};

/**
 * What a guided part read from the page.
 */
export const Result: ParentComponent<{ title: string }> = (props) => (
  <div class="flex flex-col gap-2.5 rounded-lg border border-solid border-border bg-muted/40 p-4">
    <p class="m-0 flex items-center gap-2 text-sm font-semibold" role="status">
      <LucideCheck
        class="size-4.5 shrink-0 text-violet-400"
        aria-hidden="true"
      />
      {props.title}
    </p>
    {props.children}
  </div>
);

/**
 * Something the setup noticed on the page, with a choice to make about it.
 */
export const Notice: ParentComponent<{ title: string }> = (props) => (
  <div class="flex gap-2.5 rounded-lg border border-solid border-violet-500/40 bg-violet-500/10 p-3 text-[13px] leading-normal">
    <LucideInfo
      class="mt-0.5 size-4 shrink-0 text-violet-400"
      aria-hidden="true"
    />
    <div class="flex min-w-0 flex-1 flex-col gap-2.5">
      <p class="m-0 font-semibold">{props.title}</p>
      {props.children}
    </div>
  </div>
);

/**
 * Something on the page the setup doesn't handle yet, with what to do about it.
 */
export const Warning: ParentComponent = (props) => (
  <div
    class="flex gap-2.5 rounded-lg border border-solid border-amber-500/40 bg-amber-500/10 p-3 text-[13px] leading-normal text-amber-900 dark:text-amber-200"
    role="alert"
  >
    <LucideTriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <div class="flex flex-1 flex-col items-start gap-2">{props.children}</div>
  </div>
);

/**
 * The settings behind a guided part (selectors, expressions), hidden until asked for.
 */
export const Advanced: ParentComponent = (props) => {
  const [open, setOpen] = createSignal(false);
  const id = createUniqueId();

  return (
    <div class="flex flex-col gap-2">
      <UiButton
        variant="link"
        size="inline"
        class="self-start px-0 text-violet-400"
        aria-expanded={open()}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {open() ? 'Hide advanced' : 'Advanced'}
      </UiButton>
      <Show when={open()}>
        <div id={id} class="flex flex-col gap-2">
          {props.children}
        </div>
      </Show>
    </div>
  );
};

/**
 * A slider with its label and current value.
 */
export function Range(props: {
  label: string;
  value: number;
  valueText: string;
  min: number;
  max: number;
  step: number;
  onValue: (value: number) => void;
}) {
  return (
    <label class="flex flex-col gap-2 text-sm">
      <span class="flex justify-between gap-2">
        <span class="font-semibold">{props.label}</span>
        <span class="text-muted-foreground">{props.valueText}</span>
      </span>
      <input
        type="range"
        class="w-full accent-violet-500"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        aria-valuetext={props.valueText}
        onInput={(event) => props.onValue(Number(event.currentTarget.value))}
      />
    </label>
  );
}
