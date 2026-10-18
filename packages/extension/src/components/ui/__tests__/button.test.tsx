import { afterEach, describe, expect, it, mock } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import { Button, buttonVariants } from '../button';

afterEach(cleanup);

describe('button', () => {
  it('renders a button with the default variant and size', () => {
    render(() => <Button>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });

    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('h-10 px-4 py-2');
  });

  it('applies the variant, size and extra classes', () => {
    render(() => (
      <Button variant="destructive" size="lg" class="extra">
        Delete
      </Button>
    ));

    const button = screen.getByRole('button', { name: 'Delete' });

    expect(button.className).toContain('bg-destructive');
    expect(button.className).toContain('h-11 px-8');
    expect(button.className).toContain('extra');
  });

  it('calls onClick', () => {
    const onClick = mock();

    render(() => <Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Click' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exposes the variant classes', () => {
    expect(buttonVariants({ variant: 'link', size: 'icon' })).toContain(
      'size-10',
    );
  });
});
