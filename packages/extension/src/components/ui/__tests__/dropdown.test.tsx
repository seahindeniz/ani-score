import { afterEach, describe, expect, it, mock } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import { Dropdown } from '../dropdown';

const options = [
  { value: 'grid', label: 'Grid' },
  { value: 'flex', label: 'Row' },
  { value: 'block', label: 'Blocks' },
];

function setUp(initial: string | null = 'flex') {
  const [value, setValue] = createSignal(initial ?? undefined);
  const onChange = mock(setValue);

  render(() => (
    <Dropdown
      aria-label="Layout"
      placeholder="Choose one…"
      value={value()}
      options={options}
      onChange={onChange}
    />
  ));

  return { value, onChange, button: screen.getByRole('combobox') };
}

const listbox = () => screen.queryByRole('listbox', { name: 'Layout' });
const active = (button: HTMLElement) =>
  document.getElementById(button.getAttribute('aria-activedescendant')!)
    ?.textContent;

afterEach(cleanup);

describe('Dropdown', () => {
  it('shows the chosen option, or the placeholder', () => {
    const { button } = setUp();

    expect(button.textContent).toBe('Row');

    cleanup();

    expect(setUp(null).button.textContent).toBe('Choose one…');
  });

  it('opens a list below the button, and chooses with a click', () => {
    const { button, value } = setUp();

    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(listbox()!.style.top).toBe('4px');
    expect(
      screen.getByRole('option', { name: 'Row' }).getAttribute('aria-selected'),
    ).toBe('true');

    fireEvent.pointerMove(screen.getByRole('option', { name: 'Blocks' }));

    expect(active(button)).toBe('Blocks');

    fireEvent.mouseDown(screen.getByRole('option', { name: 'Blocks' }));
    fireEvent.click(screen.getByRole('option', { name: 'Blocks' }));

    expect(value()).toBe('block');
    expect(listbox()).toBeNull();

    fireEvent.click(button);
    fireEvent.click(button);

    expect(listbox()).toBeNull();
  });

  it('opens above the button when there is no room below', () => {
    const { button } = setUp();
    const rect = { top: 700, bottom: 728, left: 10, width: 200 };

    const innerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')!;

    button.getBoundingClientRect = () => rect as DOMRect;
    Object.defineProperty(window, 'innerHeight', {
      value: 760,
      configurable: true,
    });

    try {
      fireEvent.click(button);

      expect(listbox()!.style.bottom).toBe('64px');
    } finally {
      Object.defineProperty(window, 'innerHeight', innerHeight);
    }
  });

  it('works with the keys a select has', () => {
    const { button, value, onChange } = setUp();

    fireEvent.keyDown(button, { key: 'a' });

    expect(listbox()).toBeNull();

    fireEvent.keyDown(button, { key: 'ArrowDown' });

    expect(active(button)).toBe('Row');

    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });

    expect(active(button)).toBe('Blocks');

    fireEvent.keyDown(button, { key: 'Home' });
    fireEvent.keyDown(button, { key: 'ArrowUp' });

    expect(active(button)).toBe('Grid');

    fireEvent.keyDown(button, { key: 'End' });
    fireEvent.keyDown(button, { key: 'x' });
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(value()).toBe('block');

    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: 'Escape' });

    expect(listbox()).toBeNull();

    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: 'Tab' });

    expect(listbox()).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('follows the button when the page scrolls, and closes when it loses focus', () => {
    const { button } = setUp();
    let top = 0;

    button.getBoundingClientRect = () =>
      ({ top, bottom: top + 28, left: 0, width: 100 }) as DOMRect;
    fireEvent.click(button);
    top = 100;
    window.dispatchEvent(new Event('resize'));

    expect(listbox()!.style.top).toBe('132px');

    top = 200;
    // The list scrolling itself doesn't move it
    listbox()!.dispatchEvent(new Event('scroll'));

    expect(listbox()!.style.top).toBe('132px');

    document.dispatchEvent(new Event('scroll'));

    expect(listbox()!.style.top).toBe('232px');

    fireEvent.focusOut(button);

    expect(listbox()).toBeNull();
  });
});
