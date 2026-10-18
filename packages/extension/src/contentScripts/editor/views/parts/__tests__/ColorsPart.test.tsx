import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SiteConfig } from '~/sites/schema';
import { wait } from '~/utils/wait';

import { renderInEditor, settle } from '../../__tests__/harness';
import { ColorsPart, themeSummary } from '../ColorsPart';

const site: SiteConfig = {
  schemaVersion: 1,
  id: 'example',
  name: 'Example',
  matches: ['*://example.com/*'],
  pages: [
    {
      match: {},
      cards: [{ selector: '.card', title: {}, inject: { position: 'append' } }],
    },
  ],
};

function setUp(
  theme: SiteConfig['theme'],
  detected: 'dark' | 'light' = 'dark',
) {
  const [config, setConfig] = createSignal<SiteConfig>({ ...site, theme });
  const result = renderInEditor(() => (
    <ColorsPart
      config={config()}
      onChange={(changes) =>
        setConfig((current) => ({ ...current, ...changes }))
      }
      detected={detected}
      advanced
    />
  ));

  return { ...result, config };
}

const radio = (name: RegExp) =>
  screen.getByRole('radio', { name }) as HTMLInputElement;

afterEach(() => {
  cleanup();
  document.body.removeAttribute('class');
  document.body.removeAttribute('style');
});

describe('ColorsPart', () => {
  it('sets dark or light colors, and marks the detected ones', () => {
    const { config } = setUp(undefined);

    expect(radio(/Like your browser/).checked).toBe(true);
    expect(radio(/^Dark/).parentElement!.textContent).toBe('DarkDetected');

    fireEvent.click(radio(/^Light/));

    expect(config().theme).toBe('light');
    expect(
      screen.queryByRole('radio', { name: /Like your browser/ }),
    ).toBeNull();

    fireEvent.click(radio(/^Dark/));

    expect(config().theme).toBe('dark');
  });

  it("learns the site's switch from the user flipping it", async () => {
    const { config } = setUp('light', 'light');

    fireEvent.click(radio(/Follow the site's light and dark switch/));

    expect(radio(/Follow the site's/).checked).toBe(true);
    expect(screen.getByRole('status').textContent).toBe(
      "Now flip the site's light and dark switch. AniScore is watching.",
    );

    document.body.style.backgroundColor = 'rgb(0, 0, 0)';
    document.body.classList.add('dark-mode');
    await settle();

    expect(config().theme).toEqual({ dark: { selector: 'body.dark-mode' } });
    expect(radio(/Follow the site's/).parentElement!.textContent).toContain(
      'Dark while body.dark-mode',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Learn the switch again' }),
    );

    expect(screen.getByRole('status').textContent).toStartWith('Now flip');

    fireEvent.click(radio(/^Light/));

    expect(config().theme).toBe('light');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stops learning when the user chooses otherwise', async () => {
    const { config } = setUp('light');

    fireEvent.click(radio(/Follow the site's/));
    fireEvent.click(radio(/^Dark/));
    document.body.style.backgroundColor = 'rgb(0, 0, 0)';
    document.body.classList.add('dark-mode');
    await wait(10);

    expect(config().theme).toBe('dark');
  });

  it('edits the learned condition under Advanced', () => {
    const { config } = setUp({
      dark: { selector: 'html.dark' },
    });

    fireEvent.click(radio(/Follow the site's/));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.input(
      screen.getByRole('textbox', { name: /Dark while this matches/ }),
      { target: { value: 'body.night' } },
    );

    expect(config().theme).toEqual({ dark: { selector: 'body.night' } });
  });

  it('has no advanced settings until the switch is learned', () => {
    setUp('dark');

    expect(screen.queryByRole('button', { name: 'Advanced' })).toBeNull();
  });

  it('edits a stored value condition under Advanced', () => {
    const { config } = setUp({
      dark: { localStorage: { key: 'theme', equals: 'dark' } },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.input(screen.getByRole('textbox', { name: 'Stored key' }), {
      target: { value: 'temabuton' },
    });
    fireEvent.input(screen.getByRole('textbox', { name: 'Dark value' }), {
      target: { value: 'night' },
    });

    expect(config().theme).toEqual({
      dark: { localStorage: { key: 'temabuton', equals: 'night' } },
    });
  });
});

describe('themeSummary', () => {
  it('names the colors', () => {
    expect(themeSummary('dark').text).toBe('Dark');
    expect(themeSummary('light').text).toBe('Light');
    expect(themeSummary('system').text).toBe('Like your browser');
    expect(themeSummary({ dark: { selector: 'html.dark' } }).text).toBe(
      "Follows the site's switch",
    );
  });
});
