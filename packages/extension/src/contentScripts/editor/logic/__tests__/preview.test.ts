import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { useRefStore } from '~/contentScripts/engagement/store/refStore';
import type { SiteConfig } from '~/sites/schema';
import { wait } from '~/utils/wait';

import { createPreview } from '../preview';

const config: SiteConfig = {
  schemaVersion: 1,
  id: 'example',
  name: 'Example',
  matches: ['*://example.com/*'],
  pages: [
    {
      match: {},
      cards: [{ selector: '.card', title: {}, inject: { position: 'append' } }],
    },
  ],
};

const details = () => document.querySelectorAll('.card .ani-score');

describe('createPreview', () => {
  beforeEach(() => {
    window.messageGateway = {
      sendMessage: mock(async () => undefined),
    } as unknown as typeof window.messageGateway;
    document.body.innerHTML = '<div class="card">Frieren</div>';
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'messageGateway');
    useRefStore().portalRoot = null;
  });

  it('runs AniScore with the config shortly after the last change', async () => {
    const preview = createPreview();

    preview.update({ ...config, name: '' });
    preview.update(config);

    expect(details()).toHaveLength(0);

    await wait(450);

    expect(details()).toHaveLength(1);

    preview.dispose();

    expect(details()).toHaveLength(0);
  });

  it('shows nothing for a config that does not validate', () => {
    const preview = createPreview();

    preview.now(config);
    expect(details()).toHaveLength(1);

    preview.now({ ...config, pages: [] });
    expect(details()).toHaveLength(0);

    preview.dispose();
  });
});
