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

  function toggleAnilistAuthorization() {
    if (tokenStore.data().anilist) {
      tokenStore.setData({ ...tokenStore.data(), anilist: '' })

      return
    }

    browser.tabs.create({
      url: 'https://anilist.co/api/v2/oauth/authorize?client_id=30282&response_type=token',
    })
  }

  return (
    <main class="w-full flex flex-wrap items-start justify-center gap-6 px-4 py-5 text-center text-gray-700">
      <Show when={!tokenStore.data().anilist}>
        <Button
          size="lg"
          class={clsx('flex items-center justify-center')}
          onClick={toggleAnilistAuthorization}
        >
          <SimpleIconsAnilist />
          Authorize Anilist
        </Button>
      </Show>
      <GenreColors />
      <TagColor />
    </main>
  )
}
