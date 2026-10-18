import { afterEach, describe, expect, it, mock } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import { AlreadySetUp } from '../AlreadySetUp';

function setUp(props: { source: 'yours' | 'built-in'; savedAt?: number }) {
  const handlers = { onEdit: mock(), onStartOver: mock(), onCancel: mock() };

  render(() => <AlreadySetUp host="anizm.net" {...props} {...handlers} />);

  return handlers;
}

const dialog = () =>
  screen.getByRole('dialog', { name: 'anizm.net is already set up' });

afterEach(cleanup);

describe('AlreadySetUp', () => {
  it('asks whether to edit the setup or start from scratch', () => {
    const { onEdit, onStartOver, onCancel } = setUp({ source: 'built-in' });

    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText(/AniScore comes with a setup/)).toBeTruthy();
    // The first choice has focus
    expect(document.activeElement?.textContent).toStartWith('Edit the setup');

    fireEvent.click(screen.getByRole('button', { name: /^Edit the setup/ }));
    fireEvent.click(
      screen.getByRole('button', { name: /^Start from scratch/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onEdit).toHaveBeenCalled();
    expect(onStartOver).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('says when the user saved theirs', () => {
    setUp({ source: 'yours', savedAt: Date.UTC(2026, 9, 12, 12) });

    expect(dialog().textContent).toContain(
      'You saved a setup for this site on',
    );
    expect(dialog().textContent).toContain('12');

    cleanup();
    setUp({ source: 'yours' });

    expect(dialog().textContent).toContain(
      'You saved a setup for this site. Change it',
    );
  });

  it('keeps the focus inside, and cancels on Escape', () => {
    const { onCancel } = setUp({ source: 'built-in' });
    const buttons = screen.getAllByRole('button');

    fireEvent.keyDown(dialog(), { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(buttons.at(-1)!);

    fireEvent.keyDown(dialog(), { key: 'Tab' });

    expect(document.activeElement).toBe(buttons[0]);

    fireEvent.keyDown(dialog(), { key: 'Tab' });

    expect(document.activeElement).toBe(buttons[1]);

    fireEvent.keyDown(dialog(), { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(buttons[0]);

    buttons.at(-1)!.focus();
    fireEvent.keyDown(dialog(), { key: 'Tab' });

    expect(document.activeElement).toBe(buttons[0]);

    fireEvent.keyDown(dialog(), { key: 'a' });
    fireEvent.keyDown(dialog(), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
