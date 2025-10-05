import { cacheExchange, Client, fetchExchange } from '@urql/core'
import { useTokenStore } from '~/logic'

export const anilistClient = new Client({
  url: 'https://graphql.anilist.co',
  exchanges: [cacheExchange, fetchExchange],
  preferGetMethod: false,
  async fetch(input, init) {
    const tokenStore = useTokenStore()

    await tokenStore.dataReady

    return fetch(input, {
      ...init,
      headers: {
        'Authorization': `Bearer ${tokenStore.data().anilist}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  },
})
