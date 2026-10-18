import { afterEach, describe, expect, it, mock } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { Position } from '../Panel';
import { clampPosition, Panel } from '../Panel';
import { renderInEditor, settle } from './harness';

function setUp(initial?: Position) {
  const [position, setPosition] = createSignal(initial);
  const onClose = mock();
  const result = renderInEditor(() => (
    <Panel
      label="AniScore setup"
      title="Set up example.com"
      subtitle="Not saved yet"
      position={position()}
      onMove={setPosition}
      onClose={onClose}
      footer={<button type="button">Next</button>}
    >
      <p>Body</p>
    </Panel>
  ));

  return { ...result, position, onClose };
}

const handle = () => screen.getByRole('button', { name: /^Move the panel/ });
const panel = () => screen.getByRole('dialog', { name: 'AniScore setup' });

afterEach(cleanup);

describe('Panel', () => {
  it('shows its title, body and footer, and closes', () => {
    const { onClose } = setUp();

    expect(handle().textContent).toBe('Set up example.comNot saved yet');
    expect(panel().style.right).toBe('16px');
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('moves where it is dragged by its header, staying on screen', () => {
    const { position } = setUp({ x: 100, y: 100 });

    // Other buttons don't drag
    fireEvent.pointerDown(handle(), { button: 2, clientX: 0, clientY: 0 });
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50 }));

    expect(position()).toEqual({ x: 100, y: 100 });

    // Grabbed 10px into the panel, which happy-dom lays out at 0, 0
    fireEvent.pointerDown(handle(), { button: 0, clientX: 10, clientY: 10 });
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 210, clientY: 160 }),
    );

    expect(position()).toEqual({ x: 200, y: 150 });
    expect(panel().style.left).toBe('200px');

    window.dispatchEvent(new MouseEvent('pointerup'));
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 0, clientY: 0 }),
    );

    expect(position()).toEqual({ x: 200, y: 150 });
  });

  it('moves with the arrow keys on its header', () => {
    const { position } = setUp({ x: 100, y: 100 });

    for (const key of ['ArrowRight', 'ArrowDown', 'Enter']) {
      fireEvent.keyDown(handle(), { key });
    }

    // happy-dom lays nothing out, so each move starts from 0, 0
    expect(position()).toEqual({ x: 0, y: 24 });

    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    fireEvent.keyDown(handle(), { key: 'ArrowUp' });

    expect(position()).toEqual({ x: 0, y: 0 });
  });

  it('says when the user is picking', async () => {
    const { pick } = setUp();

    expect(screen.queryByRole('status')).toBeNull();

    void pick();
    await settle();

    expect(screen.getByRole('status').textContent).toBe(
      'Click on the page. Esc cancels.',
    );
  });
});

describe('clampPosition', () => {
  it('keeps the header on screen', () => {
    expect(clampPosition({ x: -10, y: -10 })).toEqual({ x: 0, y: 0 });
    expect(clampPosition({ x: 99_999, y: 99_999 })).toEqual({
      x: window.innerWidth - 380,
      y: window.innerHeight - 56,
    });
  });
});
