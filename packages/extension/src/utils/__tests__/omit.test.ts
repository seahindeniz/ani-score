import { describe, expect, it } from 'bun:test';

import { objectOmit } from '../omit';

describe('objectOmit', () => {
  it('removes the given keys', () => {
    expect(objectOmit({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ b: 2 });
  });

  it('keeps undefined values unless asked to omit them', () => {
    expect(objectOmit({ a: 1, b: undefined }, [])).toEqual({
      a: 1,
      b: undefined,
    });
    expect<object>(
      objectOmit({ a: 1, b: undefined }, [], { omitUndefined: true }),
    ).toEqual({ a: 1 });
  });
});
