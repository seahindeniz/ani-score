import type { Component } from 'solid-js'
import { tokenStore } from '~/logic'

export const TokenReceived: Component = () => {
  const hash = new URLSearchParams(location.hash.slice(1))
  const token = hash.get('access_token')

  if (token) {
    tokenStore.setData({
      anilist: token,
    })
  }

  return (
    <main class="w-full px-4 py-5 text-center text-xl text-gray-700">
      <h2>Token Received</h2>
      <p>You can now close this tab.</p>
      <button onClick={() => window.close()} class="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">Close Tab</button>
    </main>
  )
}
