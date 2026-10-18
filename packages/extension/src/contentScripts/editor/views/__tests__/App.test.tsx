import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import { useRefStore } from '~/contentScripts/engagement/store/refStore';
import type { SiteConfig } from '~/sites/schema';
import { wait } from '~/utils/wait';

import type { AppProps } from '../App';
import { App } from '../App';
import { cardSpec, episodeGrid, settle } from './harness';

const config: SiteConfig = {
  schemaVersion: 1,
  id: 'kitsune',
  name: 'Kitsune',
  matches: ['*://example.com/*'],
  theme: 'dark',
  pages: [
    {
      match: {},
      cards: [
        cardSpec({
          selector: 'div.episodes > div.cell',
          episode: { selector: 'span', steps: [{ match: '(\\d+)\\. Bölüm' }] },
          inject: { selector: 'h3', position: 'after' },
        }),
      ],
    },
  ],
};

function setUp(overrides: Partial<AppProps> = {}) {
  const cards = episodeGrid();
  const host = document.createElement('div');

  document.body.append(host);

  const props = {
    host,
    onDraft: mock(),
    onSave: mock(async (_: SiteConfig) => {}),
    onDelete: mock(async (_: string) => {}),
    onClose: mock(),
    ...overrides,
  };
  const result = render(() => <App {...props} />, { container: host });

  return { ...result, props, host, cards };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
const panel = (name: string) => screen.queryByRole('dialog', { name });

describe('App', () => {
  beforeEach(() => {
    window.messageGateway = {
      sendMessage: mock(async () => undefined),
    } as unknown as typeof window.messageGateway;
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, 'messageGateway');
    useRefStore().portalRoot = null;
  });

  it('sets up a new site step by step, picking on the page but never in itself', async () => {
    const { cards, host, props } = setUp();

    expect(panel('AniScore setup')).toBeTruthy();
    expect(heading()).toBe('Find the episode cards');
    expect(screen.getByRole('status').textContent).toBe(
      'Click on the page. Esc cancels.',
    );

    host.querySelector('button')!.click();
    cards[1].querySelector('h3')!.click();
    await settle();

    expect(screen.getByText('Found 5 cards')).toBeTruthy();
    expect(cards[1].parentElement!.getAttribute('data-ani-score-mark')).toBe(
      'card',
    );

    // It reads the page again when the site changes it
    cards[0].parentElement!.after(cards[0].parentElement!.cloneNode(true));
    await wait(350);

    expect(screen.getByText('Found 6 cards')).toBeTruthy();

    fireEvent.click(button('Next'));
    await wait(550);

    expect(props.onDraft).toHaveBeenLastCalledWith({
      config: expect.objectContaining({ id: 'example' }),
      step: 1,
    });
  });

  it('asks first on a site that has a setup', () => {
    const { props } = setUp({ existing: { config, source: 'built-in' } });

    expect(
      screen.getByRole('dialog', { name: 'example.com is already set up' }),
    ).toBeTruthy();

    fireEvent.click(button('Cancel'));

    expect(props.onClose).toHaveBeenCalled();
  });

  it('edits the existing setup, previewing it on the page', async () => {
    const { props } = setUp({ existing: { config, source: 'built-in' } });

    fireEvent.click(button(/^Edit the setup/));

    expect(panel('AniScore editor')).toBeTruthy();
    expect(screen.getByText("AniScore's built-in setup")).toBeTruthy();
    expect(screen.queryByRole('menuitem')).toBeNull();

    await wait(450);

    expect(document.querySelectorAll('div.cell .ani-score')).toHaveLength(5);

    fireEvent.click(button(/Colors/));
    fireEvent.click(screen.getByRole('radio', { name: /^Light/ }));
    await wait(550);

    expect(props.onDraft).toHaveBeenLastCalledWith({
      config: { ...config, theme: 'light' },
    });

    fireEvent.click(button('Discard'));
    await wait(550);

    expect(props.onDraft).toHaveBeenLastCalledWith(undefined);
    expect(screen.getByText('No changes')).toBeTruthy();
  });

  it('starts from scratch, keeping the id so saving replaces the setup', () => {
    setUp({
      existing: { config, source: 'yours', savedAt: Date.UTC(2026, 9, 12) },
    });

    fireEvent.click(button(/^Start from scratch/));

    expect(panel('AniScore setup')).toBeTruthy();
    expect(heading()).toBe('Find the episode cards');
  });

  it('goes on with a draft where it was left', () => {
    setUp({
      existing: { config, source: 'yours' },
      draft: { config, step: 4 },
    });

    expect(heading()).toBe('Choose where the score goes');

    cleanup();
    setUp({
      existing: { config, source: 'yours' },
      draft: { config: { ...config, name: 'Drafted' } },
    });

    expect(panel('AniScore editor')).toBeTruthy();
    expect(screen.getByText('Your setup')).toBeTruthy();
    expect(screen.getByText('Unsaved changes, shown on the page')).toBeTruthy();
  });

  it('starts over from a draft with nothing saved to go back to', () => {
    setUp({ draft: { config } });

    expect(screen.getByText('Not saved yet')).toBeTruthy();

    fireEvent.click(button('Discard'));

    expect(panel('AniScore setup')).toBeTruthy();
  });

  it('saves, then edits the saved setup, and deletes it', async () => {
    const { props } = setUp({ draft: { config, step: 7 } });

    fireEvent.click(button('Save'));
    await settle();

    expect(props.onSave).toHaveBeenCalledWith(config);

    fireEvent.click(button('Open the editor'));

    expect(screen.getByText(/^Your setup, saved/)).toBeTruthy();
    expect(screen.getByText('No changes')).toBeTruthy();

    fireEvent.click(button('More actions'));
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Start from scratch' }),
    );

    expect(heading()).toBe('Find the episode cards');

    cleanup();

    const deleting = setUp({
      existing: { config, source: 'yours' },
      draft: { config },
    });

    fireEvent.click(button('More actions'));
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Delete this setup' }),
    );
    fireEvent.click(button('Delete'));
    await settle();

    expect(deleting.props.onDelete).toHaveBeenCalledWith('kitsune');
    expect(deleting.props.onClose).toHaveBeenCalled();
  });
});
