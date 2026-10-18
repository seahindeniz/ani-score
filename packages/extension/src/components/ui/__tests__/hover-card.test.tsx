import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@solidjs/testing-library';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '../hover-card';

afterEach(cleanup);

describe('hover card', () => {
  it('renders the open content into the body by default', async () => {
    render(() => (
      <HoverCard open>
        <HoverCardTrigger href="https://anilist.co">AniList</HoverCardTrigger>
        <HoverCardContent class="extra">Details</HoverCardContent>
      </HoverCard>
    ));

    const content = await screen.findByText('Details');

    expect(screen.getByText('AniList').tagName).toBe('A');
    expect(content.className).toContain('rounded-md border');
    expect(content.className).toContain('extra');
    expect(document.body.contains(content)).toBe(true);
  });

  it('renders the content into the given element', async () => {
    const portTo = document.createElement('div');

    document.body.append(portTo);
    render(() => (
      <HoverCard open>
        <HoverCardTrigger>Trigger</HoverCardTrigger>
        <HoverCardContent portTo={portTo}>Ported</HoverCardContent>
      </HoverCard>
    ));

    expect(portTo.contains(await screen.findByText('Ported'))).toBe(true);
  });
});
