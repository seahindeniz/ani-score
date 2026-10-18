import { describe, expect, it } from 'bun:test';

import { liveInterval, rootContainerClass } from '../main';

describe('constants', () => {
  it('pings every 5 seconds', () => {
    expect(liveInterval).toBe(5000);
  });

  it('derives the portal root class from the extension name', () => {
    expect(rootContainerClass).toBe('ani-score-portal-root');
  });
});
