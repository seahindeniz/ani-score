import logo from '~/assets/logo.svg'
import SharedSubtitle from '~/components/SharedSubtitle'
import { AppContextProviderComponent } from '~/logic/app-context'
import { storageComposable } from '~/logic/storage'

export default function Options() {
  const { data: storageDemo, setData: setStorageDemo } = storageComposable

  return (
    <AppContextProviderComponent context="options">
      <main class="px-4 py-10 text-center text-gray-700 dark:text-gray-200">
        <img src={logo} class="icon-btn mx-2 text-2xl" alt="extension icon" />
        <div>Options</div>
        <SharedSubtitle />

        <input
          value={storageDemo()}
          onInput={e => setStorageDemo(e.currentTarget.value)}
          class="border border-gray-400 rounded px-2 py-1 mt-2"
        />

        <div class="mt-4">
          Powered by Vite ⚡
        </div>
      </main>
    </AppContextProviderComponent>
  )
}
