import { createSignal } from 'solid-js'
import 'uno.css'

export default function App() {
  const [show, setShow] = createSignal(false)

  const toggle = () => setShow(!show())

  return (
    <div class="fixed bottom-0 right-0 z-100 m-5 flex select-none items-end leading-1em font-sans">
      <div
        class="h-min w-max rounded-lg bg-white text-gray-800 shadow transition-opacity duration-300"
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
          Vitesse WebExt1
        </h1>
      </div>
      <button
        class="h-10 w-10 flex cursor-pointer rounded-full border-none bg-teal-600 shadow hover:bg-teal-700"
        onClick={toggle}
      >
        <span class="m-auto block text-lg text-white">⚡</span>
      </button>
    </div>
  )
}
