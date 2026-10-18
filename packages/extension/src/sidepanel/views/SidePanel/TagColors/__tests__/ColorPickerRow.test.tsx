import { afterEach, describe, expect, it, mock } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import { ColorPickerRow } from '../ColorPickerRow';

afterEach(cleanup);

function setup(names?: string[]) {
  const updateColor = mock();
  const resetColor = mock();

  render(() => (
    <ColorPickerRow
      name="action"
      color="#ff0000"
      names={names}
      updateColor={updateColor}
      resetColor={resetColor}
    />
  ));

  return { updateColor, resetColor };
}

describe('color picker row', () => {
  it('edits a free-form tag name in lower case', () => {
    const { updateColor } = setup();
    const input = screen.getByPlaceholderText(
      'Enter tag name',
    ) as HTMLInputElement;

    expect(input.value).toBe('action');

    input.value = 'Time Skip';
    fireEvent.input(input);

    expect(updateColor).toHaveBeenCalledWith({ name: 'time skip' });
  });

  async function pickOption(trigger: HTMLElement, name: string) {
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' });
    fireEvent.click(trigger);

    const option = await screen.findByRole('option', { name });

    fireEvent.pointerDown(option, { button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(option, { button: 0, pointerType: 'mouse' });
    fireEvent.click(option);
  }

  it('picks the name from a list', async () => {
    const { updateColor } = setup(['action', 'Drama']);

    await pickOption(screen.getByRole('button', { name: /action/i }), 'Drama');

    expect(updateColor).toHaveBeenCalledWith({ name: 'Drama' });
  });

  it('keeps the name when the current one is picked again', async () => {
    const { updateColor } = setup(['action', 'Drama']);

    await pickOption(screen.getByRole('button', { name: /action/i }), 'action');

    expect(updateColor).not.toHaveBeenCalledWith({ name: null });
    expect(screen.getByRole('button', { name: /action/i })).toBeTruthy();
  });

  it('changes the color and resets the row', () => {
    const { updateColor, resetColor } = setup();
    const color = document.querySelector<HTMLInputElement>(
      'input[type="color"]',
    )!;

    expect(color.value).toBe('#ff0000');

    color.value = '#00ff00';
    fireEvent.input(color);
    expect(updateColor).toHaveBeenCalledWith({ color: '#00ff00' });

    fireEvent.click(screen.getAllByRole('button').at(-1)!);
    expect(resetColor).toHaveBeenCalledTimes(1);
  });
});
