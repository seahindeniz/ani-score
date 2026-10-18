import { describe, expect, it } from 'bun:test';

import { filterNullish } from '../filterNullish';

describe('filterNullish', () => {
  it('drops null and undefined but keeps other falsy values', () => {
    expect(filterNullish([0, null, '', undefined, false, 'a'])).toEqual([
      0,
      '',
      false,
      'a',
    ]);
  });
});
