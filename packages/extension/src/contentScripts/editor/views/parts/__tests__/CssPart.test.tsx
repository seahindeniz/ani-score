import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SiteConfig, SitePage } from '~/sites/schema';

import { renderInEditor, settle } from '../../__tests__/harness';
import { CssPart, cssSummary } from '../CssPart';

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

function setUp() {
  const [config, setConfig] = createSignal(site);
  const [page, setPage] = createSignal<SitePage>(site.pages[0]);
  const result = renderInEditor(() => (
    <CssPart
      config={config()}
      onChange={(changes) =>
        setConfig((current) => ({ ...current, ...changes }))
      }
      page={page()}
      onPageChange={(changes) =>
        setPage((current) => ({ ...current, ...changes }))
      }
    />
  ));

  return { ...result, config, page };
}

const textbox = (name: RegExp) => screen.getByRole('textbox', { name });
const pickOverlay = () =>
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Pick an overlay that blocks the cards',
    }),
  );

afterEach(cleanup);

describe('CssPart', () => {
  it("edits the site's and the page's CSS", () => {
    const { config, page } = setUp();

    fireEvent.input(textbox(/^Every page of the site/), {
      target: { value: 'a {}' },
    });
    fireEvent.input(textbox(/^This page/), { target: { value: 'b {}' } });

    expect(config().css).toBe('a {}');
    expect(page().css).toBe('b {}');
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.input(textbox(/^Every page of the site/), {
      target: { value: '' },
    });
    fireEvent.input(textbox(/^This page/), { target: { value: '' } });

    expect(config().css).toBeUndefined();
    expect(page().css).toBeUndefined();
  });

  it("says why AniScore can't use the CSS", () => {
    setUp();

    fireEvent.input(textbox(/^This page/), {
      target: { value: '@import "https://example.com/a.css";' },
    });

    expect(screen.getByText(/CSS may not load other resources/)).toBeTruthy();
  });

  it('adds a rule that lets clicks through an overlay', async () => {
    document.body.innerHTML = '<div class="overlay"></div>';

    const { config, willPick } = setUp();

    fireEvent.input(textbox(/^Every page of the site/), {
      target: { value: 'a {}' },
    });
    willPick(document.querySelector('.overlay')!);
    pickOverlay();
    await settle();

    expect(config().css).toBe(
      'a {}\n/* Lets clicks and hovers through to the cards */\ndiv.overlay {\n  pointer-events: none !important;\n}',
    );

    willPick(undefined);
    pickOverlay();
    await settle();

    expect(config().css).toEndWith('}');
  });
});

describe('cssSummary', () => {
  const [page] = site.pages;

  it('says where there is CSS', () => {
    expect(cssSummary(site, page).text).toBe('None');
    expect(cssSummary({ ...site, css: 'a {}' }, page).text).toBe(
      'For the site',
    );
    expect(cssSummary(site, { ...page, css: 'a {}' }).text).toBe(
      'For this page',
    );
    expect(
      cssSummary({ ...site, css: 'a {}' }, { ...page, css: ' ' }).text,
    ).toBe('For the site');
    expect(
      cssSummary({ ...site, css: 'a {}' }, { ...page, css: 'b {}' }).text,
    ).toBe('For the site and this page');
  });

  it("flags CSS AniScore can't use", () => {
    expect(
      cssSummary(site, { ...page, css: 'a { background: url(x.png) }' }),
    ).toEqual({ text: "Has CSS AniScore can't use", status: 'issue' });
  });
});
