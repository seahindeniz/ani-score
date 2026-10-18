import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@solidjs/testing-library';

import { Separator } from '../separator';

afterEach(cleanup);

describe('separator', () => {
  it('is horizontal by default', () => {
    render(() => <Separator data-testid="separator" />);

    const separator = screen.getByTestId('separator');

    expect(separator.getAttribute('data-orientation')).toBe('horizontal');
    expect(separator.className).toContain('h-px w-full');
  });

  it('renders vertically', () => {
    render(() => (
      <Separator data-testid="separator" orientation="vertical" class="extra" />
    ));

    const separator = screen.getByTestId('separator');

    expect(separator.getAttribute('data-orientation')).toBe('vertical');
    expect(separator.className).toContain('h-full w-px');
    expect(separator.className).toContain('extra');
  });
});
