import { expect, test } from 'bun:test';

import * as main from '../index';
import * as publish from '../publish';

// The main entry is what the extension reads; how the index is packed and published stays behind `/publish`
test('the entry points expose what their side uses', () => {
  expect(Object.keys(main).sort()).toEqual([
    'animeIndexFormat',
    'buildAnimeIndex',
    'fetchRelease',
    'listSiteHosts',
    'prebuiltIndexFiles',
    'prebuiltIndexURLs',
    'prebuiltSource',
    'readAnimeIndex',
    'upstreamSources',
  ]);
  expect(Object.keys(publish).sort()).toEqual([
    'createPrebuiltIndex',
    'packAnimeIndex',
    'prebuiltIndexDownloadURL',
    'publishAnimeIndex',
  ]);
});
