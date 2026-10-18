import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import { fakeBrowser } from '../../../test/fake-browser';
import Options from '../Options';

afterEach(cleanup);

describe('options', () => {
  it('saves the typed demo value to storage', async () => {
    render(() => <Options />);

    expect(screen.getByAltText('extension icon')).toBeTruthy();

    const input = screen.getByRole('textbox') as HTMLInputElement;

    input.value = 'Typed';
    fireEvent.input(input);

    expect(fakeBrowser.storage.local.set).toHaveBeenCalledWith({
      'webext-demo': 'Typed',
    });
    expect(input.value).toBe('Typed');
  });
});
