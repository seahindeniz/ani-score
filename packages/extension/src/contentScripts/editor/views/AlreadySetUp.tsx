import type { Component, JSX } from 'solid-js';
import LucidePencil from '~icons/lucide/pencil';
import LucideRotateCcw from '~icons/lucide/rotate-ccw';

import { Button } from '~/components/ui/button';

import { Dialog } from './Dialog';

const DialogChoice: Component<{
  icon: JSX.Element;
  label: string;
  description: string;
  onClick: () => void;
}> = (props) => (
  <button
    type="button"
    class="flex cursor-pointer items-start gap-3.5 rounded-lg border border-solid border-input bg-transparent px-4 py-3.5 text-left text-foreground transition-colors hover:border-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    onClick={() => props.onClick()}
  >
    <span class="mt-0.5 shrink-0" aria-hidden="true">
      {props.icon}
    </span>
    <span class="flex flex-col gap-1">
      <span class="text-[15px] font-semibold">{props.label}</span>
      <span class="text-[13px] leading-normal text-muted-foreground">
        {props.description}
      </span>
    </span>
  </button>
);

/**
 * Asks what to do on a site that already has a setup: change it, or set the site up again from the first step.
 */
export const AlreadySetUp: Component<{
  host: string;
  /**
   * Whose setup it is: the user's, or the one AniScore comes with.
   */
  source: 'yours' | 'built-in';
  savedAt?: number;
  onEdit: () => void;
  onStartOver: () => void;
  onCancel: () => void;
}> = (props) => (
  <Dialog
    title={`${props.host} is already set up`}
    description={
      props.source === 'built-in'
        ? 'AniScore comes with a setup for this site. Change it, or set the site up again. Your version is saved as your own, and the side panel can bring the built-in one back.'
        : `You saved a setup for this site${props.savedAt ? ` on ${new Date(props.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}` : ''}. Change it, or set the site up again from the first step.`
    }
    onCancel={props.onCancel}
  >
    <div class="flex flex-col gap-2.5">
      <DialogChoice
        icon={<LucidePencil class="size-5" />}
        label="Edit the setup"
        description="Opens the editor with everything filled in. Change only what's wrong."
        onClick={props.onEdit}
      />
      <DialogChoice
        icon={<LucideRotateCcw class="size-5" />}
        label="Start from scratch"
        description="Walks you through picking the cards, name and episode again. The current setup keeps working until you save."
        onClick={props.onStartOver}
      />
    </div>
    <div class="flex justify-end">
      <Button variant="ghost" size="sm" onClick={() => props.onCancel()}>
        Cancel
      </Button>
    </div>
  </Dialog>
);
