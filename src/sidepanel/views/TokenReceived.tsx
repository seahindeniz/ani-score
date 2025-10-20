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
    <main class="flex flex-col items-center gap-6 py-12 text-center">
      <div class="flex flex-col items-center">
        <h1 class="text-2xl font-semibold tracking-tight">Token Received</h1>
        <p class="text-size-base text-muted-foreground">You can now close this tab</p>
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
