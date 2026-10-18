import { afterEach, describe, expect, it, mock } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import { Switch } from '../switch';

afterEach(cleanup);

describe('switch', () => {
  it('is a labelled switch that reports the state the user asks for', () => {
    const onChange = mock();

    render(() => (
      <Switch label="Anizm" checked={false} onChange={onChange} class="extra" />
    ));

    const toggle = screen.getByRole('switch', { name: 'Anizm' });

    expect((toggle as HTMLInputElement).checked).toBe(false);

    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(true);
    expect(toggle.closest('.extra')).not.toBeNull();
  });

  it('shows the state it is given, not the one clicked', () => {
    const [checked, setChecked] = createSignal(false);

    render(() => (
      <Switch label="Anizm" checked={checked()} onChange={() => {}} />
    ));

    const toggle = screen.getByRole('switch') as HTMLInputElement;

    fireEvent.click(toggle);
    expect(toggle.closest('[data-checked]')).toBeNull();

    setChecked(true);
    expect(toggle.closest('[data-checked]')).not.toBeNull();
  });

  it("can't be changed while disabled", () => {
    const onChange = mock();

    render(() => (
      <Switch label="Anizm" checked={false} onChange={onChange} disabled />
    ));

    fireEvent.click(screen.getByRole('switch'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
