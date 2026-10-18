import * as SwitchPrimitive from '@kobalte/core/switch';

import { cn } from '~/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /**
   * What the switch turns on, for screen readers; the switch shows no text of its own.
   */
  label: string;
  disabled?: boolean;
  class?: string;
}

function Switch(props: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      class={cn('inline-flex shrink-0', props.class)}
      checked={props.checked}
      onChange={(checked) => props.onChange(checked)}
      disabled={props.disabled}
    >
      <SwitchPrimitive.Input class="peer" aria-label={props.label} />
      <SwitchPrimitive.Control class="relative h-5 w-9 cursor-pointer rounded-full bg-input transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
        <SwitchPrimitive.Thumb class="absolute left-0.5 top-0.5 size-4 rounded-full bg-muted-foreground transition-transform motion-reduce:transition-none data-[checked]:translate-x-4 data-[checked]:bg-primary-foreground" />
      </SwitchPrimitive.Control>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
export type { SwitchProps };
