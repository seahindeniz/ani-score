import type { Component } from 'solid-js';
import { Show } from 'solid-js';

import { useTokenStore } from '~/logic';

import { Account } from './Account';
import { Sites } from './Sites/Sites';
import { GenreColors } from './TagColors/GenreColors';
import { TagColor } from './TagColors/TagColors';

export const SidePanel: Component = () => {
  const tokenStore = useTokenStore();

  return (
    <main class="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5 text-left text-foreground">
      {/* The browser's side panel shows the name and icon above it already */}
      <h1 class="sr-only">AniScore</h1>
      <Account />
      <Sites />
      <Show when={tokenStore.data().anilist}>
        <GenreColors />
        <TagColor />
      </Show>
    </main>
  );
};
