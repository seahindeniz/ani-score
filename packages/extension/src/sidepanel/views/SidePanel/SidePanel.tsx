import type { Component } from 'solid-js';
import { Show } from 'solid-js';

import logo from '~/assets/logo.svg';
import { useTokenStore } from '~/logic';

import { Account } from './Account';
import { Sites } from './Sites/Sites';
import { GenreColors } from './TagColors/GenreColors';
import { TagColor } from './TagColors/TagColors';

export const SidePanel: Component = () => {
  const tokenStore = useTokenStore();

  return (
    <main class="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5 text-left text-foreground">
      <header class="flex items-center gap-2">
        <img src={logo} alt="" class="size-7" />
        <h1 class="m-0 text-lg font-semibold">AniScore</h1>
      </header>
      <Account />
      <Sites />
      <Show when={tokenStore.data().anilist}>
        <GenreColors />
        <TagColor />
      </Show>
    </main>
  );
};
