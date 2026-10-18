import { afterEach, describe, expect, it, mock } from 'bun:test';

import { wait } from '~/utils/wait';

import type { ThemeSnapshot } from '../themeSwitch';
import {
  describeCondition,
  learnThemeSwitch,
  snapshotTheme,
  switchCondition,
} from '../themeSwitch';

const snapshot = (changes: Partial<ThemeSnapshot> = {}): ThemeSnapshot => ({
  classes: { html: [], body: [] },
  attributes: { html: {}, body: {} },
  storage: {},
  dark: false,
  ...changes,
});

afterEach(() => {
  document.documentElement.removeAttribute('class');
  document.documentElement.removeAttribute('data-theme');
  document.body.removeAttribute('class');
  document.body.removeAttribute('style');
  localStorage.clear();
});

describe('snapshotTheme', () => {
  it('reads where sites keep their theme, and whether the page is dark', () => {
    document.documentElement.className = 'dark js';
    document.documentElement.dataset.theme = 'dark';
    document.body.style.backgroundColor = 'rgb(0, 0, 0)';
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('history', 'x'.repeat(50));

    expect(snapshotTheme()).toEqual({
      classes: { html: ['dark', 'js'], body: [] },
      attributes: {
        html: expect.objectContaining({ 'data-theme': 'dark' }),
        body: {},
      },
      storage: { theme: 'dark' },
      dark: true,
    });
  });

  it('does without storage the page blocks', () => {
    const getItem = Object.getOwnPropertyDescriptor(window, 'localStorage')!;

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Blocked');
      },
    });

    try {
      expect(snapshotTheme().storage).toEqual({});
    } finally {
      Object.defineProperty(window, 'localStorage', getItem);
    }
  });
});

describe('switchCondition', () => {
  it('prefers a class the dark mode adds, in either order', () => {
    const light = snapshot({ classes: { html: [], body: ['page'] } });
    const dark = snapshot({
      classes: { html: [], body: ['page', 'dark-mode'] },
      dark: true,
    });

    expect(switchCondition(light, dark)).toEqual({
      selector: 'body.dark-mode',
    });
    expect(switchCondition(dark, light)).toEqual({
      selector: 'body.dark-mode',
    });
  });

  it('uses an attribute, a class the light mode adds, or a stored value', () => {
    expect(
      switchCondition(
        snapshot({ attributes: { html: { 'data-theme': 'light' }, body: {} } }),
        snapshot({
          attributes: { html: { 'data-theme': 'dark' }, body: {} },
          dark: true,
        }),
      ),
    ).toEqual({ selector: 'html[data-theme="dark"]' });
    expect(
      switchCondition(
        snapshot({ classes: { html: ['light'], body: [] } }),
        snapshot({ dark: true }),
      ),
    ).toEqual({ selector: 'html:not(.light)' });
    expect(
      switchCondition(
        snapshot({ storage: { temabuton: 'light' } }),
        snapshot({ storage: { temabuton: 'dark' }, dark: true }),
      ),
    ).toEqual({ localStorage: { key: 'temabuton', equals: 'dark' } });
  });

  it("finds nothing when the page didn't turn dark or light, or nothing tells the modes apart", () => {
    expect(
      switchCondition(
        snapshot(),
        snapshot({ classes: { html: ['dark'], body: [] } }),
      ),
    ).toBeUndefined();
    expect(
      switchCondition(snapshot(), snapshot({ dark: true })),
    ).toBeUndefined();
  });
});

describe('learnThemeSwitch', () => {
  it('reports the condition once the user flips the switch, then stops', async () => {
    const onLearned = mock();

    learnThemeSwitch(onLearned);
    document.body.style.backgroundColor = 'rgb(0, 0, 0)';
    document.body.classList.add('dark-mode');
    await wait();

    expect(onLearned).toHaveBeenCalledWith({ selector: 'body.dark-mode' });

    document.body.classList.add('other');
    await wait();

    expect(onLearned).toHaveBeenCalledTimes(1);
  });

  it('can stop waiting', async () => {
    const onLearned = mock();
    const stop = learnThemeSwitch(onLearned);

    stop();
    document.body.style.backgroundColor = 'rgb(0, 0, 0)';
    document.body.classList.add('dark-mode');
    await wait(600);

    expect(onLearned).not.toHaveBeenCalled();
  });
});

describe('describeCondition', () => {
  it('puts a condition in words', () => {
    expect(describeCondition({ selector: 'html.dark' })).toBe('html.dark');
    expect(
      describeCondition({
        any: [
          { selector: 'html.dark' },
          { localStorage: { key: 'theme', equals: 'dark' } },
        ],
      }),
    ).toBe('html.dark or the site stores theme = dark');
  });
});
