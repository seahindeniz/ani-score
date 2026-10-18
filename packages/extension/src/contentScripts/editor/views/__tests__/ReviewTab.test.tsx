import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import type { SiteConfig } from '~/sites/schema';
import { wait } from '~/utils/wait';

import { ReviewTab } from '../ReviewTab';

const config: SiteConfig = {
  schemaVersion: 1,
  id: 'openani',
  name: 'OpenAni',
  matches: ['*://openani.me/*'],
  pages: [
    {
      match: {},
      cards: [{ selector: '.card', title: {}, inject: { position: 'append' } }],
    },
  ],
};

afterEach(cleanup);

describe('ReviewTab', () => {
  it('says what is missing, and only saves a complete config', () => {
    const onSave = mock(async () => {});

    render(() => (
      <ReviewTab draft={{ ...config, pages: [] }} onSave={onSave} />
    ));

    expect(screen.getByRole('alert').textContent).toContain('pages');
    expect(
      screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('saves the config', async () => {
    const onSave = mock(async () => {});

    render(() => <ReviewTab draft={config} onSave={onSave} />);

    expect(screen.getByText('The config is complete.')).toBeTruthy();
    expect(
      JSON.parse(
        (screen.getByRole('textbox', { name: 'Config' }) as HTMLTextAreaElement)
          .value,
      ),
    ).toEqual(config);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await wait();

    expect(onSave).toHaveBeenCalledWith(config);
    expect(screen.getByRole('status').textContent).toBe(
      "Saved to your sites. If AniScore isn't on for OpenAni yet, turn it on in its side panel.",
    );
  });

  it('copies and downloads the config', async () => {
    const writeText = mock(async () => {});
    const createObjectURL = spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:config',
    );
    const revokeObjectURL = spyOn(URL, 'revokeObjectURL').mockImplementation(
      () => {},
    );
    const click = spyOn(
      HTMLAnchorElement.prototype,
      'click',
    ).mockImplementation(() => {});

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(() => (
      <ReviewTab
        draft={{ ...config, id: '' }}
        onSave={() => Promise.resolve()}
      />
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await wait();

    expect(writeText).toHaveBeenCalledWith(
      `${JSON.stringify({ ...config, id: '' }, null, 2)}\n`,
    );
    expect(screen.getByRole('status').textContent).toBe('Copied.');

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'site.json',
    );
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:config');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });

  it('shares the config through a prefilled GitHub issue', async () => {
    const open = spyOn(window, 'open').mockImplementation(() => null);
    const writeText = mock(async () => {});

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const { unmount } = render(() => (
      <ReviewTab draft={config} onSave={() => Promise.resolve()} />
    ));

    fireEvent.click(
      screen.getByRole('button', { name: 'Share with everyone' }),
    );
    await wait();

    const [[url, target, features]] = open.mock.calls as [
      [string, string, string],
    ];

    expect(new URL(url).searchParams.get('config')).toBe(
      JSON.stringify(config, null, 2),
    );
    expect([target, features]).toEqual(['_blank', 'noopener']);
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe(
      'Opened a GitHub issue with the config. Once a maintainer reviews it, it ships with AniScore for everyone.',
    );
    unmount();

    // Too long for a link
    const long = { ...config, css: 'a'.repeat(9000) };

    render(() => <ReviewTab draft={long} onSave={() => Promise.resolve()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Share with everyone' }),
    );
    await wait();

    expect(writeText).toHaveBeenCalledWith(
      `${JSON.stringify(long, null, 2)}\n`,
    );
    expect(
      new URL(open.mock.calls[1][0] as string).searchParams.has('config'),
    ).toBe(false);
    expect(screen.getByRole('status').textContent).toBe(
      "The config is too long for a link, so it's on your clipboard: paste it into the form's Config field.",
    );

    open.mockRestore();
  });

  it("doesn't share or save a config that isn't complete", async () => {
    const open = spyOn(window, 'open').mockImplementation(() => null);
    const onSave = mock(async () => {});

    render(() => (
      <ReviewTab draft={{ ...config, pages: [] }} onSave={onSave} />
    ));

    // Disabled buttons can still be clicked programmatically
    screen.getByRole('button', { name: 'Share with everyone' }).click();
    screen.getByRole('button', { name: 'Save' }).click();
    await wait();

    expect(open).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    open.mockRestore();
  });
});
