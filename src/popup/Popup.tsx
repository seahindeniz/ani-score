import browser from 'webextension-polyfill'
import Logo from '~/components/Logo'
import SharedSubtitle from '~/components/SharedSubtitle'
import { AppContextProviderComponent } from '~/logic/app-context'
import { storageDemo } from '~/logic/storage'

function openOptionsPage() {
  browser.runtime.openOptionsPage()
}

export default function Popup() {
  return (
    <AppContextProviderComponent context="popup">
      <main class="w-[300px] px-4 py-5 text-center text-gray-700">
        <Logo />
        <div>Popup</div>
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
