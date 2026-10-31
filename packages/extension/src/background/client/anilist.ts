import {
  cacheExchange,
  Client,
  CombinedError,
  fetchExchange,
} from '@urql/core';

import { useTokenStore } from '~/logic';

/**
 * What a request fails with when there's no AniList token, including after AniList rejected the stored one: no
 * request goes to AniList until the user signs in again.
 */
class SignedOutError extends Error {
  constructor() {
    super('Not signed in to AniList');
    this.name = 'SignedOutError';
  }
}

export function isSignedOut(error: Error | undefined) {
  return (
    error instanceof CombinedError
    && error.networkError instanceof SignedOutError
  );
}

async function rejectsToken(response: Response) {
  if (response.ok) return false;

  const body = (await response
    .clone()
    .json()
    .catch(() => undefined)) as { errors?: { message?: string }[] } | undefined;

  return Boolean(
    body?.errors?.some(({ message }) => message === 'Invalid token'),
  );
}

export const anilistClient = new Client({
  url: 'https://graphql.anilist.co',
  exchanges: [cacheExchange, fetchExchange],
  preferGetMethod: false,
  // The cast is for the unit tests' Bun types, whose `fetch` also has a `preconnect` method that urql never calls
  fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
    const tokenStore = useTokenStore();

    await tokenStore.dataReady;

    const token = tokenStore.data().anilist;

    if (!token) throw new SignedOutError();

    const response = await fetch(input, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!(await rejectsToken(response))) return response;

    // The user may have signed in again while this request was on its way
    if (tokenStore.data().anilist === token)
      tokenStore.setData({ ...tokenStore.data(), anilist: '' });

    throw new SignedOutError();
  }) as typeof fetch,
});
