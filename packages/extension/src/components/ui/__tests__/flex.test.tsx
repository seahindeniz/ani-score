import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@solidjs/testing-library';

import { Flex } from '../flex';

afterEach(cleanup);

describe('flex', () => {
  it('defaults to a row with space between and centered items', () => {
    render(() => <Flex data-testid="flex">Content</Flex>);

    const flex = screen.getByTestId('flex');

    expect(flex.className).toContain('flex-row');
    expect(flex.className).toContain('justify-between');
    expect(flex.className).toContain('items-center');
  });

  it('maps the layout props to classes', () => {
    render(() => (
      <Flex
        data-testid="flex"
        flexDirection="col-reverse"
        justifyContent="evenly"
        alignItems="baseline"
        class="extra"
      />
    ));

    const flex = screen.getByTestId('flex');

    expect(flex.className).toContain('flex-col-reverse');
    expect(flex.className).toContain('justify-evenly');
    expect(flex.className).toContain('items-baseline');
    expect(flex.className).toContain('extra');
  });
});
