import { cacheExchange, Client, fetchExchange } from '@urql/core'
import { useTokenStore } from '~/logic'

export const anilistClient = new Client({
  url: 'https://graphql.anilist.co',
  exchanges: [cacheExchange, fetchExchange],
  preferGetMethod: false,
  // The cast is for the unit tests' Bun types, whose `fetch` also has a `preconnect` method that urql never calls
  fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
    const tokenStore = useTokenStore()

    await tokenStore.dataReady

    return fetch(input, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokenStore.data().anilist}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  }) as typeof fetch,
})
