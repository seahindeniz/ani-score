import { createSignal } from 'solid-js'
import SharedSubtitle from '~/components/SharedSubtitle'
import { AppContextProviderComponent } from '~/logic/app-context'
import 'uno.css'

export default function App() {
  const [show, setShow] = createSignal(false)

  const toggle = () => setShow(!show())

  return (
    <AppContextProviderComponent context="content-script">
      <div class="fixed right-0 bottom-0 m-5 z-100 flex items-end font-sans select-none leading-1em">
        <div
          class="bg-white text-gray-800 rounded-lg shadow w-max h-min transition-opacity duration-300"
          classList={{
            'opacity-100': show(),
            'opacity-0': !show(),
          }}
          style={{
            display: show() ? 'block' : 'none',
            padding: '1rem 1rem',
            margin: 'auto 0.5rem auto 0',
          }}
        >
          <h1 class="text-lg">
            Vitesse WebExt
          </h1>
          <SharedSubtitle />
        </div>
        <button
          class="flex w-10 h-10 rounded-full shadow cursor-pointer border-none bg-teal-600 hover:bg-teal-700"
          onClick={toggle}
        >
          <span class="block m-auto text-white text-lg">⚡</span>
        </button>
      </div>
    </AppContextProviderComponent>
  )
}
