import type { Component } from 'solid-js';
import { createMemo, createSignal, Show } from 'solid-js';

import type { SiteConfig } from '~/sites/schema';
import { parseSiteConfig } from '~/sites/schema';

import { Button, TextArea } from './controls';

/**
 * Checks the config, and saves or exports it.
 */
export const ReviewTab: Component<{
  draft: SiteConfig;
  onSave: (config: SiteConfig) => Promise<void>;
}> = (props) => {
  const result = createMemo(() => parseSiteConfig(props.draft));
  const json = () => `${JSON.stringify(props.draft, null, 2)}\n`;
  const [message, setMessage] = createSignal('');

  async function save() {
    const current = result();

    if (!current.success) return;

    await props.onSave(current.config);
    setMessage(
      `Saved to your sites. If AniScore isn't on for ${current.config.name} yet, turn it on in its side panel.`,
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(json());
    setMessage('Copied.');
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([json()], { type: 'application/json' }),
    );
    const link = document.createElement('a');

    link.href = url;
    link.download = `${props.draft.id || 'site'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div class="flex flex-col gap-2">
      <Show
        when={result().success}
        fallback={
          <p
            class="m-0 whitespace-pre-wrap text-xs text-destructive"
            role="alert"
          >
            {(result() as { error: string }).error}
          </p>
        }
      >
        <p class="m-0 text-xs">The config is complete.</p>
      </Show>
      <TextArea aria-label="Config" readOnly value={json()} class="min-h-40" />
      <div class="flex flex-wrap gap-1">
        <Button variant="primary" disabled={!result().success} onClick={save}>
          Save
        </Button>
        <Button onClick={download}>Download</Button>
        <Button onClick={copy}>Copy</Button>
      </div>
      <Show when={message()}>
        <p class="m-0 text-xs" role="status">
          {message()}
        </p>
      </Show>
    </div>
  );
};
