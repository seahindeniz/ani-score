/**
 * Where the extension built for the tests sends the user to sign in to AniList. Routes don't reach the tabs the
 * extension opens, so it's a file the dev server serves (Chrome swaps a 404 for its own error page), rather than
 * AniList's address, which would load the real site.
 */
export const signInURL = 'http://localhost:3303/popup/main.tsx?anilist-sign-in';
