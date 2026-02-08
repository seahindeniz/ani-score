import browser from 'webextension-polyfill'
import Logo from '~/components/Logo'
import { useStorageComposable } from '~/logic/storage'

function openOptionsPage() {
  browser.runtime.openOptionsPage()
}

export default function Popup() {
  const storageComposable = useStorageComposable()

  return (
    <main class="w-[300px] px-4 py-5 text-center text-gray-700">
      <Logo />
      <div>Popup</div>

      <button class="btn mt-2" onClick={openOptionsPage}>
        Open Options
      </button>
      <div class="mt-2">
        <span class="opacity-50">Storage:</span>
        {' '}
        {storageComposable.data()}
      </div>
    </main>
  )
}
