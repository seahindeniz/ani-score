import { getFontPreloadLinkAttrs } from '@kobalte/solidbase/default-theme/fonts.js';
import { getHtmlProps } from '@kobalte/solidbase/server';
// @refresh reload
import { createHandler, StartServer } from '@solidjs/start/server';
import { For } from 'solid-js';

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html {...getHtmlProps()}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta
            http-equiv="content-security-policy"
            content={
              import.meta.env.DEV
                ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws: wss:; base-uri 'self'; form-action 'self'"
                : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'"
            }
          />
          <For each={getFontPreloadLinkAttrs()}>
            {(attrs) => <link {...attrs} />}
          </For>
          <link rel="icon" href="/favicon.ico" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
