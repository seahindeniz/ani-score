import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from 'bun:test';

import { keepAlive } from '../keepAlive';

describe('keepAlive', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('calls the callback on the given interval', () => {
    const callback = mock();
    keepAlive(callback, 1000);

    jest.advanceTimersByTime(3000);

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('stops calling the callback after the returned function is called', () => {
    const callback = mock();
    const stop = keepAlive(callback, 1000);

    jest.advanceTimersByTime(2000);
    stop();
    jest.advanceTimersByTime(3000);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('pauses when the page freezes and resumes when it resumes', () => {
    const callback = mock();
    keepAlive(callback, 1000);

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event('freeze'));
    jest.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event('resume'));
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('removes lifecycle listeners after stop', () => {
    const callback = mock();
    const stop = keepAlive(callback, 1000);

    stop();

    // Freeze/resume after stop should not restart the interval
    document.dispatchEvent(new Event('resume'));
    jest.advanceTimersByTime(3000);

    expect(callback).toHaveBeenCalledTimes(0);
  });
});
