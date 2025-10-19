import type { Component } from 'solid-js'
import clsx from 'clsx'
import { Button } from '~/components/ui/button'
import { useTokenStore } from '~/logic'

export const TokenReceived: Component = () => {
  const tokenStore = useTokenStore()
  const hash = new URLSearchParams(location.hash.slice(1))
  const token = hash.get('access_token')

  if (token) {
    tokenStore.setData({
      anilist: token,
    })
  }

  return (
    <main class="flex flex-col items-center gap-6 py-5 text-center text-xl text-gray-700">
      <div class="flex flex-col items-center">
        <h2>Token Received</h2>
        <p>You can now close this tab.</p>
      </div>
      <Button
        size="lg"
        class={clsx('flex items-center justify-center')}
        onClick={() => window.close()}
      >
        Close Tab
      </Button>
    </main>
  )
}
