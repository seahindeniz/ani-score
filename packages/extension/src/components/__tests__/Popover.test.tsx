import { afterEach, describe, expect, it, mock } from 'bun:test';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import type { ComponentProps } from 'solid-js';

import { rootContainerClass } from '~/constants/main';

import { Popover } from '../Popover';

afterEach(cleanup);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function renderPopover(props: Partial<ComponentProps<typeof Popover>> = {}) {
  render(() => (
    <Popover
      trigger={<button type="button">Trigger</button>}
      openDelay={5}
      closeDelay={5}
      {...props}
    >
      <span>Popover content</span>
    </Popover>
  ));

  return screen.getByRole('button', { name: 'Trigger' }).parentElement!;
}

const content = () => screen.queryByText('Popover content');

describe('popover', () => {
  it('opens after the open delay and positions the content', async () => {
    const onChange = mock();
    const container = renderPopover({ onChange });

    fireEvent.mouseMove(container);
    // A second move while the open is pending doesn't restart it
    fireEvent.mouseMove(container);

    expect(content()).toBeNull();

    await waitFor(() => expect(content()).not.toBeNull());

    const popover = content()!.parentElement!;

    expect(popover.className).toContain('absolute');
    await waitFor(() => expect(popover.style.left).toBe('0px'));
    expect(popover.style.top).toBe('4px');
    expect(onChange.mock.calls).toEqual([[false], [true]]);
  });

  it('uses the default delays', async () => {
    render(() => (
      <Popover trigger={<button type="button">Trigger</button>}>
        <span>Popover content</span>
      </Popover>
    ));

    fireEvent.mouseMove(
      screen.getByRole('button', { name: 'Trigger' }).parentElement!,
    );
    await wait(100);

    expect(content()).toBeNull();

    await waitFor(() => expect(content()).not.toBeNull(), { timeout: 1000 });
  });

  it('cancels a pending open when the pointer leaves', async () => {
    const container = renderPopover();

    fireEvent.mouseMove(container);
    fireEvent.mouseLeave(container);
    await wait(20);

    expect(content()).toBeNull();
  });

  it('stays open when the pointer leaves the trigger, and closes once it moves elsewhere', async () => {
    const container = renderPopover();

    fireEvent.mouseMove(container);
    await waitFor(() => expect(content()).not.toBeNull());

    fireEvent.mouseLeave(container);
    // Moving within the popover or onto the extension's own portal root keeps it open
    fireEvent.mouseMove(content()!);

    const portalRoot = document.createElement('div');

    portalRoot.classList.add(rootContainerClass);
    document.body.append(portalRoot);
    fireEvent.mouseMove(portalRoot);
    await wait(20);

    expect(content()).not.toBeNull();

    fireEvent.mouseMove(document.body);
    await waitFor(() => expect(content()).toBeNull());
  });

  it('reads the real target of events from shadow DOM', async () => {
    const container = renderPopover();

    fireEvent.mouseMove(container);
    await waitFor(() => expect(content()).not.toBeNull());

    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');

    shadowRoot.append(inner);
    document.body.append(host);
    inner.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, composed: true }),
    );

    await waitFor(() => expect(content()).toBeNull());
  });

  it('cancels a pending open and restarts it when the pointer comes back', async () => {
    const container = renderPopover({ closeDelay: 50 });

    fireEvent.mouseMove(container);
    // Leaving before it opens schedules a close, which coming back cancels
    fireEvent.mouseMove(document.body);
    fireEvent.mouseMove(container);

    await waitFor(() => expect(content()).not.toBeNull());
    await wait(80);

    expect(content()).not.toBeNull();
  });

  it('closes on an outside click in click mode', async () => {
    const container = renderPopover({ closeMode: 'click' });

    fireEvent.mouseMove(container);
    await waitFor(() => expect(content()).not.toBeNull());

    fireEvent.mouseMove(document.body);
    await wait(20);

    expect(content()).not.toBeNull();

    // Unlike `fireEvent`'s, a page's own events usually aren't composed
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => expect(content()).toBeNull());
  });

  it('never closes by itself in none mode', async () => {
    const container = renderPopover({ closeMode: 'none' });

    fireEvent.mouseMove(container);
    await waitFor(() => expect(content()).not.toBeNull());

    fireEvent.mouseMove(document.body);
    await wait(20);

    expect(content()).not.toBeNull();
  });

  it('exposes close through its ref and renders into the given element', async () => {
    const portTo = document.createElement('div');
    let popover!: { close: () => void };

    document.body.append(portTo);

    const container = renderPopover({
      portTo,
      ref: (ref: typeof popover) => (popover = ref),
    } as never);

    fireEvent.mouseMove(container);
    await waitFor(() => expect(content()).not.toBeNull());

    expect(portTo.contains(content())).toBe(true);

    popover.close();

    await waitFor(() => expect(content()).toBeNull());
  });
});
