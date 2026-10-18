import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import { useStorageComposable } from '~/logic';

import { fakeBrowser } from '../../../test/fake-browser';
import Popup from '../Popup';

afterEach(() => {
  cleanup();
  // The store is shared by every test file in the run
  useStorageComposable().setData('Storage Demo');
});

describe('popup', () => {
  it('opens the options page', () => {
    render(() => <Popup />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Options' }));

    expect(fakeBrowser.runtime.openOptionsPage).toHaveBeenCalledTimes(1);
  });

  it('shows the stored demo value', async () => {
    render(() => <Popup />);

    useStorageComposable().setData('Changed');

    expect(await screen.findByText('Changed')).toBeTruthy();
  });
});
