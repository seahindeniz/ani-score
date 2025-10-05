import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import browser from 'webextension-polyfill'
import { tokenStore } from '~/logic/storage'
import { GenreColor } from './GenreColor'

export const SidePanel: Component = () => {
  function toggleAnilistAuthorization() {
    if (tokenStore.data().anilist) {
      tokenStore.setData({ anilist: '' })
      return
    }

    browser.tabs.create({
      url: 'https://anilist.co/api/v2/oauth/authorize?client_id=30282&response_type=token',
    })
  }

  return (
    <main class="w-full flex flex-col items-center gap-4 px-4 py-5 text-center text-gray-700">
      <Show when={!tokenStore.data().anilist}>
        <button
          class="ml-2 h-10 w-[200px] rounded px-2 py-1 text-sm text-white"
          classList={{
            'bg-blue-500 hover:bg-blue-600': !tokenStore.data().anilist,
            'bg-red-500 hover:bg-red-600': Boolean(tokenStore.data().anilist),
          }}
          onClick={toggleAnilistAuthorization}
        >
          <Show when={!tokenStore.data().anilist}>
            <span>Authorize Anilist</span>
          </Show>
          <Show when={Boolean(tokenStore.data().anilist)}>
            <span>Revoke Anilist</span>
          </Show>
        </button>
      </Show>
      <GenreColor />
    </main>
  )
}
