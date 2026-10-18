import * as RadioGroupPrimitive from '@kobalte/core/radio-group';
import type { JSX, ParentComponent } from 'solid-js';
import { Show } from 'solid-js';

import { cn } from '~/utils';

/**
 * A set of options shown as cards, of which one is chosen: a radio group, so arrow keys move between them.
 */
export const ChoiceGroup: ParentComponent<{
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  /**
   * Shows the label above the options; screen readers read it either way.
   */
  showLabel?: boolean;
  class?: string;
}> = (props) => (
  <RadioGroupPrimitive.Root
    value={props.value ?? ''}
    onChange={(value) => props.onChange(value)}
    class="flex flex-col gap-2"
  >
    <RadioGroupPrimitive.Label
      class={props.showLabel ? 'text-sm font-semibold' : 'sr-only'}
    >
      {props.label}
    </RadioGroupPrimitive.Label>
    <div class={cn('flex flex-col gap-2', props.class)}>{props.children}</div>
  </RadioGroupPrimitive.Root>
);

export const Choice: ParentComponent<{
  value: string;
  label: string;
  description?: JSX.Element;
  /**
   * A picture of the option, above its label.
   */
  illustration?: JSX.Element;
}> = (props) => (
  <RadioGroupPrimitive.Item value={props.value} class="group relative flex">
    <RadioGroupPrimitive.ItemInput class="peer" />
    <RadioGroupPrimitive.ItemLabel class="flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg border border-solid border-input px-3 py-2.5 text-left transition-colors hover:border-muted-foreground group-data-[checked]:border-primary group-data-[checked]:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
      {props.illustration}
      <span class="text-sm font-semibold">{props.label}</span>
      <Show when={props.description}>
        <RadioGroupPrimitive.ItemDescription class="text-xs text-muted-foreground">
          {props.description}
        </RadioGroupPrimitive.ItemDescription>
      </Show>
      {props.children}
    </RadioGroupPrimitive.ItemLabel>
  </RadioGroupPrimitive.Item>
);
