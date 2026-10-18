import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SiteConfig } from '~/sites/schema';

import { SiteTab } from '../SiteTab';
import { renderInEditor, settle } from './harness';

const config: SiteConfig = {
  schemaVersion: 1,
  id: 'openani',
  name: 'OpenAni',
  matches: ['*://openani.me/*'],
  pages: [],
};

function setUp(initial = config) {
  const [draft, setDraft] = createSignal(initial);
  const result = renderInEditor(() => (
    <SiteTab
      draft={draft()}
      onChange={(changes) => setDraft({ ...draft(), ...changes })}
    />
  ));

  return { ...result, draft };
}

const textbox = (name: RegExp) => screen.getByRole('textbox', { name });
const theme = () => screen.getByRole('combobox', { name: 'Theme' });

afterEach(cleanup);

describe('SiteTab', () => {
  it('edits the name, id and addresses', () => {
    const { draft } = setUp();

    fireEvent.input(textbox(/^Name/), { target: { value: 'Open Ani' } });
    fireEvent.input(textbox(/^Id/), { target: { value: 'open-ani' } });
    fireEvent.input(textbox(/^Addresses/), {
      target: { value: '*://openani.me/*\n\n  *://www.openani.me/*  ' },
    });

    expect(draft()).toMatchObject({
      name: 'Open Ani',
      id: 'open-ani',
      matches: ['*://openani.me/*', '*://www.openani.me/*'],
    });
  });

  it("follows the user's setting, a fixed theme, or the site's", () => {
    const { draft } = setUp();

    expect((theme() as HTMLSelectElement).value).toBe('system');

    fireEvent.change(theme(), { target: { value: 'dark' } });
    expect(draft().theme).toBe('dark');

    fireEvent.change(theme(), { target: { value: 'selector' } });
    expect(draft().theme).toEqual({ dark: { selector: 'html.dark' } });

    fireEvent.input(textbox(/^Element/), {
      target: { value: 'body.dark-mode' },
    });
    expect(draft().theme).toEqual({ dark: { selector: 'body.dark-mode' } });

    fireEvent.change(theme(), { target: { value: 'localStorage' } });
    fireEvent.input(textbox(/^Key/), { target: { value: 'temabuton' } });
    fireEvent.input(textbox(/^Dark value/), { target: { value: 'koyu' } });
    expect(draft().theme).toEqual({
      dark: { localStorage: { key: 'temabuton', equals: 'koyu' } },
    });
    expect((theme() as HTMLSelectElement).value).toBe('localStorage');

    fireEvent.change(theme(), { target: { value: 'system' } });
    expect(draft().theme).toBeUndefined();
  });

  it('edits the CSS, and lets clicks through an overlay the user picks', async () => {
    document.body.innerHTML = '<div id="popunder-catcher"></div>';

    const { draft, willPick } = setUp();

    willPick(
      document.querySelector('div')!,
      document.querySelector('div')!,
      undefined,
    );

    const unblock = () =>
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Pick an overlay that blocks the cards',
        }),
      );

    unblock();
    await settle();
    expect(draft().css).toBe(
      '/* Lets clicks and hovers through to the cards */\n#popunder-catcher {\n  pointer-events: none !important;\n}',
    );

    unblock();
    await settle();
    expect(draft().css!.match(/pointer-events/g)).toHaveLength(2);

    // Cancelled
    unblock();
    await settle();
    expect(draft().css!.match(/pointer-events/g)).toHaveLength(2);

    fireEvent.input(textbox(/^Site CSS/), { target: { value: '' } });
    expect(draft().css).toBeUndefined();
  });
});
