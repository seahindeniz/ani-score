import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test';

import type { SiteConfig } from '~/sites/schema';

import { copyConfig, downloadConfig, shareConfig } from '../exportConfig';

const config: SiteConfig = {
  schemaVersion: 1,
  id: 'openani',
  name: 'OpenAni',
  matches: ['*://openani.me/*'],
  pages: [
    {
      match: {},
      cards: [{ selector: '.card', title: {}, inject: { position: 'append' } }],
    },
  ],
};

const json = (value: SiteConfig) => `${JSON.stringify(value, null, 2)}\n`;

describe('exporting a config', () => {
  const writeText = mock(async () => {});

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copies it', async () => {
    expect(await copyConfig(config)).toBe('Copied the setup.');
    expect(writeText).toHaveBeenCalledWith(json(config));
  });

  it('downloads it, named after its id', () => {
    const createObjectURL = spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:config',
    );
    const revokeObjectURL = spyOn(URL, 'revokeObjectURL').mockImplementation(
      () => {},
    );
    const click = spyOn(
      HTMLAnchorElement.prototype,
      'click',
    ).mockImplementation(() => {});

    expect(downloadConfig(config)).toBe('Downloaded openani.json.');
    expect(downloadConfig({ ...config, id: '' })).toBe('Downloaded site.json.');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:config');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });

  it('shares it through a prefilled GitHub issue, on the clipboard when too long for the link', async () => {
    const open = spyOn(window, 'open').mockImplementation(() => null);

    expect(await shareConfig(config)).toStartWith('Opened a GitHub issue');
    expect(String(open.mock.calls[0][0])).toContain('site-integration.yml');
    expect(writeText).not.toHaveBeenCalled();

    const long = { ...config, css: `/* ${'x'.repeat(9000)} */` };

    expect(await shareConfig(long)).toStartWith('The setup is too long');
    expect(writeText).toHaveBeenCalledWith(json(long));

    open.mockRestore();
  });
});
