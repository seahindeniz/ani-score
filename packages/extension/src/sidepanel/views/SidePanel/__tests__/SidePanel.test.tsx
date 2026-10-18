import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import { useTokenStore } from '~/logic';

import { fakeBrowser } from '../../../../../test/fake-browser';
import { SidePanel } from '../SidePanel';

const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = (async () =>
    Response.json({
      data: { GenreCollection: ['Action'] },
    })) as unknown as typeof fetch;
});

// Signed out unless a test signs in; other test files share the token store
beforeEach(() => {
  useTokenStore().setData({ anilist: '' });
});

afterEach(cleanup);

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('side panel', () => {
  it('opens AniList authorization when signed out', () => {
    render(() => <SidePanel />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Sign in with AniList' }),
    );

    expect(fakeBrowser.tabs.create).toHaveBeenCalledWith({
      url: (globalThis as unknown as { ANILIST_TOKEN_URL: string })
        .ANILIST_TOKEN_URL,
    });
  });

  it('shows the color settings when signed in', async () => {
    useTokenStore().setData({ anilist: 'token' });
    render(() => <SidePanel />);

    expect(
      screen.queryByRole('button', { name: 'Sign in with AniList' }),
    ).toBeNull();
    expect(screen.getByText('Genre colors')).toBeTruthy();
    expect(screen.getByText('Tag colors')).toBeTruthy();
  });

  it('signs out, then offers to authorize again', () => {
    useTokenStore().setData({ anilist: 'token' });
    render(() => <SidePanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(useTokenStore().data().anilist).toBe('');
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Sign in with AniList' }),
    ).toBeTruthy();
    expect(fakeBrowser.tabs.create).not.toHaveBeenCalled();
  });
});
