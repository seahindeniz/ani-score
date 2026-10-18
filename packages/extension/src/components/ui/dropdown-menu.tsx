import * as DropdownMenuPrimitive from '@kobalte/core/dropdown-menu';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';

import { cn } from '~/utils';

/**
 * A menu of actions that opens from a button, e.g. the less common actions of a list row.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

type ContentProps<T extends ValidComponent = 'div'> =
  DropdownMenuPrimitive.DropdownMenuContentProps<T> & { class?: string };

export function DropdownMenuContent<T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, ContentProps<T>>,
) {
  const [local, others] = splitProps(props as ContentProps, ['class']);

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        class={cn(
          'z-50 min-w-44 origin-[var(--kb-menu-content-transform-origin)] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80',
          local.class,
        )}
        {...others}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

type ItemProps<T extends ValidComponent = 'div'> =
  DropdownMenuPrimitive.DropdownMenuItemProps<T> & {
    class?: string;
    /**
     * For an action that removes something.
     */
    destructive?: boolean;
  };

export function DropdownMenuItem<T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, ItemProps<T>>,
) {
  const [local, others] = splitProps(props as ItemProps, [
    'class',
    'destructive',
  ]);

  return (
    <DropdownMenuPrimitive.Item
      class={cn(
        'relative flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        local.destructive && 'text-red-600 dark:text-red-400',
        local.class,
      )}
      {...others}
    />
  );
}

export function DropdownMenuSeparator<T extends ValidComponent = 'hr'>(
  props: PolymorphicProps<
    T,
    DropdownMenuPrimitive.DropdownMenuSeparatorProps<T> & { class?: string }
  >,
) {
  const [local, others] = splitProps(props as { class?: string }, ['class']);

  return (
    <DropdownMenuPrimitive.Separator
      class={cn('-mx-1 my-1 h-px border-none bg-muted', local.class)}
      {...others}
    />
  );
}
