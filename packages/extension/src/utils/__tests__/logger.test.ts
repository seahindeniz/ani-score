import { afterEach, describe, expect, it, spyOn } from 'bun:test';

describe('createLogger', () => {
  const spies: ReturnType<typeof spyOn>[] = [];

  afterEach(() => {
    spies.splice(0).forEach((spy) => spy.mockRestore());
  });

  // Loggers bind the console methods when they're created, so spy before importing a fresh copy
  async function importWithSpies(id: string) {
    for (const method of ['log', 'info', 'warn', 'error'] as const)
      spies.push(spyOn(console, method).mockImplementation(() => {}));

    return import(`../logger.ts?case=${id}`) as Promise<
      typeof import('../logger')
    >;
  }

  it('prefixes every method with the styled logo and scope', async () => {
    const { createLogger } = await importWithSpies('scoped');
    const logger = createLogger('fetchDetails');

    logger.log('a', 1);
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    for (const [index, method] of (
      ['log', 'info', 'warn', 'error'] as const
    ).entries()) {
      const [format, logoStyle, scopeStyle, ...rest] =
        // eslint-disable-next-line no-console -- inspects the spied console methods
        (console[method] as unknown as ReturnType<typeof spyOn>).mock.calls[0];

      expect(format).toBe('%c %cfetchDetails');
      expect(logoStyle).toContain(
        'background-image: url(data:image/svg+xml;base64,',
      );
      expect(scopeStyle).toContain('border: 1px solid gray');
      expect(rest).toEqual([['a', 1], ['b'], ['c'], ['d']][index]);
    }
  });

  it('exports an unscoped logger with only the logo style', async () => {
    const { logger } = await importWithSpies('unscoped');

    logger.log('hello');

    const [format, logoStyle, message] =
      // eslint-disable-next-line no-console -- inspects the spied console.log
      (console.log as unknown as ReturnType<typeof spyOn>).mock.calls[0];

    expect(format).toBe('%c ');
    expect(logoStyle).toContain('background-size: contain');
    expect(message).toBe('hello');
  });
});
