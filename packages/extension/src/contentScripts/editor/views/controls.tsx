import clsx from 'clsx';
import type { JSX, ParentComponent } from 'solid-js';
import { For, Show, splitProps } from 'solid-js';

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
}) {
  return (
    <select
      class={inputClass}
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

export function Button(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary';
  },
) {
  const [local, others] = splitProps(props, ['variant', 'class']);

  return (
    <button
      type="button"
      class={clsx(
        'shrink-0 cursor-pointer whitespace-nowrap rounded border-none px-2 py-1 text-xs font-medium disabled:cursor-default disabled:opacity-50',
        local.variant === 'primary'
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground',
        local.class,
      )}
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
