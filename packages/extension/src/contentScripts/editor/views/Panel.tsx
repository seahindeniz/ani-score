import type { JSX, ParentComponent } from 'solid-js';
import { Show } from 'solid-js';
import LucideGripVertical from '~icons/lucide/grip-vertical';
import LucideStar from '~icons/lucide/star';
import LucideX from '~icons/lucide/x';

import { Button } from '~/components/ui/button';

import { useEditor } from './context';

export interface Position {
  x: number;
  y: number;
}

const width = 380;
const step = 24;

/**
 * Keeps the panel's header on screen, so it can always be dragged back.
 */
export const clampPosition = ({ x, y }: Position): Position => ({
  x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - width)),
  y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - 56)),
});

/**
 * The editor's floating panel: dragged by its header (or moved with the arrow keys there), with a body that scrolls and
 * a footer for the actions.
 */
export const Panel: ParentComponent<{
  label: string;
  title: string;
  subtitle?: string;
  /**
   * Buttons in the header, before Close.
   */
  actions?: JSX.Element;
  /**
   * Above the body, e.g. the guided setup's progress.
   */
  top?: JSX.Element;
  footer?: JSX.Element;
  position: Position | undefined;
  onMove: (position: Position) => void;
  onClose: () => void;
}> = (props) => {
  const editor = useEditor();
  let panel!: HTMLDivElement;

  const start = () => {
    const { left, top } = panel.getBoundingClientRect();

    return { x: left, y: top };
  };

  function drag(event: PointerEvent) {
    if (event.button !== 0) return;

    const from = start();
    const offset = { x: event.clientX - from.x, y: event.clientY - from.y };
    const move = (moveEvent: PointerEvent) =>
      props.onMove(
        clampPosition({
          x: moveEvent.clientX - offset.x,
          y: moveEvent.clientY - offset.y,
        }),
      );
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function nudge(event: KeyboardEvent) {
    const moves: Record<string, Position> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const move = moves[event.key];

    if (!move) return;

    event.preventDefault();

    const from = start();

    props.onMove(clampPosition({ x: from.x + move.x, y: from.y + move.y }));
  }

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={props.label}
      class="fixed z-[2147483647] flex max-h-[calc(100vh-32px)] w-[380px] flex-col overflow-hidden rounded-xl border border-solid border-border bg-background text-foreground shadow-2xl"
      style={
        props.position
          ? { left: `${props.position.x}px`, top: `${props.position.y}px` }
          : { right: '16px', top: '16px' }
      }
    >
      <header class="flex items-center gap-1 border-b border-b-solid border-border p-2">
        <button
          type="button"
          class="flex h-11 min-w-0 flex-1 cursor-grab touch-none select-none items-center gap-2.5 rounded-lg border-none bg-transparent px-2 text-left text-foreground active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`Move the panel: drag it, or use the arrow keys. ${props.title}`}
          onPointerDown={drag}
          onKeyDown={nudge}
        >
          <LucideGripVertical
            class="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span class="flex size-6.5 shrink-0 items-center justify-center rounded-md bg-violet-500 text-white">
            <LucideStar class="size-3.5" aria-hidden="true" />
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-sm font-semibold">{props.title}</span>
            <Show when={props.subtitle}>
              <span class="truncate text-xs text-muted-foreground">
                {props.subtitle}
              </span>
            </Show>
          </span>
        </button>
        {props.actions}
        <Button
          variant="ghost"
          size="icon"
          class="size-8 text-muted-foreground"
          aria-label="Close"
          onClick={() => props.onClose()}
        >
          <LucideX aria-hidden="true" />
        </Button>
      </header>
      <Show when={editor.picking()}>
        <p
          class="m-0 bg-violet-500 px-4 py-1.5 text-xs font-medium text-white"
          role="status"
        >
          Click on the page. Esc cancels.
        </p>
      </Show>
      {props.top}
      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        {props.children}
      </div>
      <Show when={props.footer}>
        <footer class="flex items-center gap-2 border-t border-t-solid border-border px-4 py-3">
          {props.footer}
        </footer>
      </Show>
    </div>
  );
};
