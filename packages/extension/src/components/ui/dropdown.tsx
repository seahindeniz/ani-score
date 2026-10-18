import { createSignal, createUniqueId, For, onCleanup, Show } from 'solid-js';
import LucideCheck from '~icons/lucide/check';
import LucideChevronDown from '~icons/lucide/chevron-down';

import { cn } from '~/utils';

export interface DropdownOption<Value extends string> {
  value: Value;
  label: string;
}

const optionHeight = 32;
const maxListHeight = 240;

/**
 * A select whose list the extension draws: a native one on another site's page takes the page's colors, which can
 * leave its options unreadable. The list opens below the button (above it when there's no room), and the keys work
 * like a select's: arrows, Home, End, Enter or Space to choose, Escape to close.
 */
export function Dropdown<Value extends string>(props: {
  value: Value | undefined;
  options: DropdownOption<Value>[];
  onChange: (value: Value) => void;
  /**
   * Shown while nothing is chosen, e.g. "Add a step…".
   */
  placeholder?: string;
  'aria-label'?: string;
  id?: string;
  class?: string;
}) {
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(0);
  const [place, setPlace] = createSignal<Record<string, string>>({});
  const listId = createUniqueId();
  const optionId = (index: number) => `${listId}-${index}`;
  let trigger!: HTMLButtonElement;
  let list: HTMLUListElement | undefined;

  const selected = () =>
    props.options.find((option) => option.value === props.value);

  // Next to the button, also after scrolling (but not when it's the list that scrolls)
  const onScroll = (event: Event) => {
    if (!list?.contains(event.composedPath()[0] as Node)) position();
  };

  function position() {
    const rect = trigger.getBoundingClientRect();
    const height = Math.min(
      maxListHeight,
      props.options.length * optionHeight + 8,
    );
    const below = window.innerHeight - rect.bottom;
    const side: Record<string, string> =
      below >= height || below >= rect.top
        ? { top: `${rect.bottom + 4}px` }
        : { bottom: `${window.innerHeight - rect.top + 4}px` };

    setPlace({ ...side, left: `${rect.left}px`, width: `${rect.width}px` });
  }

  function show() {
    position();
    setActive(
      Math.max(
        0,
        props.options.findIndex((option) => option.value === props.value),
      ),
    );
    setOpen(true);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', onScroll, true);
  }

  function hide() {
    setOpen(false);
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', onScroll, true);
  }

  onCleanup(hide);

  function choose(index: number) {
    const option = props.options[index];

    hide();
    trigger.focus();
    props.onChange(option.value);
  }

  function onKeyDown(event: KeyboardEvent) {
    const last = props.options.length - 1;

    if (!open()) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        show();
      }

      return;
    }

    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active() + 1),
      ArrowUp: Math.max(0, active() - 1),
      Home: 0,
      End: last,
    };

    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
      list
        ?.querySelector(`#${CSS.escape(optionId(active()))}`)
        ?.scrollIntoView?.({ block: 'nearest' });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active());
    } else if (event.key === 'Escape') {
      event.preventDefault();
      hide();
    } else if (event.key === 'Tab') {
      hide();
    }
  }

  return (
    <>
      <button
        ref={trigger}
        id={props.id}
        type="button"
        role="combobox"
        aria-label={props['aria-label']}
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-controls={listId}
        aria-activedescendant={open() ? optionId(active()) : undefined}
        class={cn(
          'flex h-7 w-full min-w-0 cursor-pointer items-center justify-between gap-1 rounded border border-solid border-input bg-transparent px-2 text-left text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring',
          props.class,
        )}
        onClick={() => (open() ? hide() : show())}
        onKeyDown={onKeyDown}
        onFocusOut={hide}
      >
        <span
          class="truncate"
          classList={{ 'text-muted-foreground': !selected() }}
        >
          {selected()?.label ?? props.placeholder}
        </span>
        <LucideChevronDown
          class="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
      <Show when={open()}>
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={props['aria-label']}
          class="fixed z-[2147483647] m-0 flex list-none flex-col overflow-y-auto rounded-md border border-solid border-border bg-popover p-1 text-popover-foreground shadow-lg"
          style={{ ...place(), 'max-height': `${maxListHeight}px` }}
        >
          <For each={props.options}>
            {(option, index) => (
              <li
                id={optionId(index())}
                role="option"
                aria-selected={option.value === props.value}
                class="flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded px-2 text-xs"
                classList={{
                  'bg-accent text-accent-foreground': index() === active(),
                }}
                // Keeps the focus on the button, so the list doesn't close before the click
                onMouseDown={(event) => event.preventDefault()}
                onPointerMove={() => setActive(index())}
                onClick={() => choose(index())}
              >
                {option.label}
                <Show when={option.value === props.value}>
                  <LucideCheck class="size-3.5 shrink-0" aria-hidden="true" />
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </>
  );
}
