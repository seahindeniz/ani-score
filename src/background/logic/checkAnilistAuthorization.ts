import { createEffect, on } from 'solid-js'
import { tokenStore } from '~/logic'

export async function checkAnilistAuthorization() {
  await tokenStore.dataReady

  if (tokenStore.data().anilist) {
    return
  }

  browser.action.setBadgeText({ text: 'Login' })
  browser.action.setBadgeBackgroundColor({ color: '#DD0303' })

  createEffect(on(tokenStore.data, (data) => {
    if (data.anilist) {
      browser.action.setBadgeText({ text: '' })
      browser.action.setBadgeBackgroundColor({ color: '' })
    }
  }, { defer: true }))
}
