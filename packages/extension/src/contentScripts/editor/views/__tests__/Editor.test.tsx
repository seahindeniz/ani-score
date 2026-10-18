import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import { useRefStore } from '~/contentScripts/engagement/store/refStore';
import type { SiteConfig } from '~/sites/schema';
import { wait } from '~/utils/wait';

import type { EditorProps } from '../Editor';
import { Editor } from '../Editor';

const config: SiteConfig = {
  schemaVersion: 1,
  id: 'example',
  name: 'Example',
  matches: ['*://example.com/*'],
  pages: [
    {
      match: {},
      cards: [{ selector: '.card', title: {}, inject: { position: 'append' } }],
    },
    {
      match: { path: '^/elsewhere$' },
      cards: [
        { selector: '.other', title: {}, inject: { position: 'append' } },
      ],
    },
  ],
};

function setUp(overrides: Partial<EditorProps> = {}) {
  document.body.innerHTML =
    '<div class="card">Frieren</div><div class="card">Dandadan</div>';

  const host = document.createElement('div');

  document.body.append(host);

  const props = {
    initial: config,
    host,
    onDraft: mock(),
    onSave: mock(async () => {}),
    onStartOver: mock(async () => ({ ...config, name: 'Fresh' })),
    onClose: mock(),
    ...overrides,
  };
  const result = render(() => <Editor {...props} />, { container: host });

  return { ...result, props, host };
}

const dialog = () =>
  screen.getByRole('dialog', { name: 'AniScore site editor' });
const cardCount = () =>
  screen
    .getAllByRole('status')
    .find((status) => status.textContent!.includes('on this page'))!
    .textContent;

describe('Editor', () => {
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

  it('switches between the site, its pages and saving', () => {
    setUp();

    expect(dialog().textContent).toContain('AniScore · Example');
    expect(
      screen.getByRole('tab', { name: 'Pages' }).getAttribute('aria-selected'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: 'Site' }));
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Save' }));
    expect(screen.getByText('The config is complete.')).toBeTruthy();
  });

  it('previews the config on the page, unless turned off', async () => {
    setUp();

    await wait(450);
    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(2);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Live preview' }));
    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(0);
  });

  it('outlines the cards of the pages that apply where the user is', () => {
    setUp({
      initial: {
        ...config,
        pages: [
          ...config.pages,
          // A path still being typed
          {
            match: { path: '(' },
            cards: [
              {
                selector: '.typing',
                title: {},
                inject: { position: 'append' },
              },
            ],
          },
        ],
      },
    });

    const outlines = Array.from(
      document.head.querySelectorAll('style'),
      (style) => style.textContent,
    ).join('\n');

    expect(outlines).toContain(':is(.card) {');
    expect(outlines).not.toContain(':is(.other)');
    expect(outlines).not.toContain(':is(.typing)');
  });

  it('keeps unsaved changes as a draft', async () => {
    const { props } = setUp();

    fireEvent.input(screen.getByRole('textbox', { name: 'Card selector' }), {
      target: { value: 'div.card' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Site' }));
    fireEvent.input(screen.getByRole('textbox', { name: /^Name/ }), {
      target: { value: 'Renamed' },
    });
    await wait(550);

    const [first, second] = config.pages;

    expect(props.onDraft).toHaveBeenCalledTimes(1);
    expect(props.onDraft).toHaveBeenCalledWith({
      ...config,
      name: 'Renamed',
      pages: [
        { ...first, cards: [{ ...first.cards[0], selector: 'div.card' }] },
        second,
      ],
    });
  });

  it('starts over from what the caller gives', async () => {
    setUp();

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    await wait();

    expect(dialog().textContent).toContain('AniScore · Fresh');
  });

  it('says how to pick, ignores clicks on itself, and stops on Escape', async () => {
    const { host } = setUp();

    fireEvent.click(screen.getByRole('button', { name: 'Pick a card' }));

    expect(
      screen.getByText('Click an element on the page. Esc cancels.'),
    ).toBeTruthy();

    // A click in the editor isn't a pick
    host.querySelector('header')!.click();
    expect(
      screen.getByText('Click an element on the page. Esc cancels.'),
    ).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wait();

    expect(
      screen.queryByText('Click an element on the page. Esc cancels.'),
    ).toBeNull();
  });

  it('reads the page again after the site changed it, but not after its own changes', async () => {
    setUp({
      initial: {
        ...config,
        pages: [
          {
            ...config.pages[0],
            cards: [{ ...config.pages[0].cards[0], selector: '.late' }],
          },
        ],
      },
    });

    expect(cardCount()).toBe('0 cards on this page');

    const late = document.createElement('div');

    late.className = 'late';
    late.textContent = 'Late';
    document.body.prepend(late);
    await wait(350);

    expect(cardCount()).toBe('1 card on this page');

    late.firstChild!.textContent = 'Later';
    await wait(350);

    expect(cardCount()).toBe('1 card on this page');
  });

  it('minimizes, moves and closes', () => {
    const { props, host } = setUp();

    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(screen.queryAllByRole('tablist')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getAllByRole('tablist').length).toBeGreaterThan(0);

    const header = host.querySelector('header')!;

    fireEvent.pointerDown(header, { clientX: 10, clientY: 10 });
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 110, clientY: 60 }),
    );
    window.dispatchEvent(new MouseEvent('pointerup'));
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 500, clientY: 500 }),
    );

    expect(dialog().style.left).toBe('100px');
    expect(dialog().style.top).toBe('50px');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('removes its outlines and preview when it goes away', async () => {
    const { unmount } = setUp();

    await wait(450);
    unmount();

    expect(document.head.querySelector('style')).toBeNull();
    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(0);
  });
});
