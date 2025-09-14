import browser from 'webextension-polyfill'
import Logo from '~/components/Logo'
import SharedSubtitle from '~/components/SharedSubtitle'
import { AppContextProviderComponent } from '~/logic/app-context'
import { storageComposable } from '~/logic/storage'

function openOptionsPage() {
  browser.runtime.openOptionsPage()
}

export default function Sidepanel() {
  const { data: storageDemo } = storageComposable

  return (
    <AppContextProviderComponent context="sidepanel">
      <main class="w-full px-4 py-5 text-center text-gray-700">
        <Logo />
        <div>Sidepanel</div>
        <SharedSubtitle />

        <button class="btn mt-2" onClick={openOptionsPage}>
          Open Options
        </button>
        <div class="mt-2">
          <span class="opacity-50">Storage:</span>
          {' '}
          {storageDemo()}
        </div>
      </main>
    </AppContextProviderComponent>
  )
}
