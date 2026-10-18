import type { ParentComponent } from 'solid-js';
import { createUniqueId, onMount } from 'solid-js';

const focusable =
  'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A modal question over the page. Focus starts on the first control and stays inside, and Escape cancels.
 */
export const Dialog: ParentComponent<{
  title: string;
  description: string;
  onCancel: () => void;
}> = (props) => {
  const id = createUniqueId();
  let dialog!: HTMLDivElement;

  onMount(() => dialog.querySelector<HTMLElement>(focusable)?.focus());

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      props.onCancel();

      return;
    }

    if (event.key !== 'Tab') return;

    const controls = Array.from(
      dialog.querySelectorAll<HTMLElement>(focusable),
    );
    const root = dialog.getRootNode() as Document | ShadowRoot;
    const at = controls.indexOf(root.activeElement as HTMLElement);
    const next = event.shiftKey
      ? at <= 0
        ? controls.at(-1)
        : controls[at - 1]
      : at === controls.length - 1
        ? controls[0]
        : controls[at + 1];

    event.preventDefault();
    next?.focus();
  }

  return (
    <div class="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        class="flex w-full max-w-[480px] flex-col gap-5 rounded-xl border border-solid border-border bg-background p-6 text-foreground shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div class="flex flex-col gap-2">
          <h2 id={`${id}-title`} class="m-0 text-lg font-semibold">
            {props.title}
          </h2>
          <p
            id={`${id}-description`}
            class="m-0 text-sm leading-relaxed text-muted-foreground"
          >
            {props.description}
          </p>
        </div>
        {props.children}
      </div>
    </div>
  );
};
