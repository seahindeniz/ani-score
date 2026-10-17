import type { Component } from 'solid-js'
import clsx from 'clsx'
import { Show } from 'solid-js'
import browser from 'webextension-polyfill'
import SimpleIconsAnilist from '~icons/simple-icons/anilist'
import { Button } from '~/components/ui/button'
import { useTokenStore } from '~/logic'
import { GenreColors } from './TagColors/GenreColors'
import { TagColor } from './TagColors/TagColors'

export const SidePanel: Component = () => {
  const tokenStore = useTokenStore()

  function authorizeAnilist() {
    browser.tabs.create({ url: ANILIST_TOKEN_URL })
  }

  function signOut() {
    tokenStore.setData({ ...tokenStore.data(), anilist: '' })
  }

  return (
    <main class="w-full flex flex-wrap items-start justify-center gap-6 px-4 py-5 text-center text-gray-700">
      <Show
        when={tokenStore.data().anilist}
        fallback={(
          <Button
            size="lg"
            class={clsx('flex items-center justify-center')}
            onClick={authorizeAnilist}
          >
            <SimpleIconsAnilist />
            Authorize Anilist
          </Button>
        )}
      >
        <GenreColors />
        <TagColor />
        <div class="w-full flex justify-center">
          <Button variant="outline" onClick={signOut}>
            <SimpleIconsAnilist />
            Sign out of AniList
          </Button>
        </div>
      </Show>
    </main>
  )
}
