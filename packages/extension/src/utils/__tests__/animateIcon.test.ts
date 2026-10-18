import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test';

import { animateIcon } from '../animateIcon';

function createFakeContext() {
  const colorStops: [number, string][] = [];
  const context = new Proxy(
    {
      colorStops,
      createLinearGradient: mock(() => ({
        addColorStop: (offset: number, color: string) =>
          colorStops.push([offset, color]),
      })),
      getImageData: mock(() => ({ width: 16, height: 16 })),
    } as Record<string | symbol, any>,
    {
      get: (target, prop) =>
        prop in target ? target[prop] : (target[prop] = mock(() => {})),
    },
  );

  return context;
}

describe('animateIcon', () => {
  let context: ReturnType<typeof createFakeContext>;
  let scheduled: (() => void)[];
  let setTimeoutSpy: ReturnType<typeof spyOn>;
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;

  beforeEach(() => {
    context = createFakeContext();
    scheduled = [];
    globalThis.OffscreenCanvas = class {
      getContext = () => context;
    } as unknown as typeof OffscreenCanvas;
    setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(((
      callback: () => void,
    ) => {
      scheduled.push(callback);

      return 0;
    }) as unknown as typeof setTimeout);
  });

  afterEach(() => {
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
    setTimeoutSpy.mockRestore();
  });

  it('draws a frame and sets it as the toolbar icon', () => {
    animateIcon();

    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      imageData: { width: 16, height: 16 },
    });
    // The first frame uses the first colors of the gradient cycle
    expect(context.colorStops).toEqual([
      [0, 'rgb(248, 87, 166)'],
      [1, 'rgb(255, 88, 88)'],
    ]);
    expect(context.arc).toHaveBeenCalledTimes(4);
    expect(context.fill).toHaveBeenCalledTimes(2);
  });

  it('keeps animating at ~60 frames per second, blending towards the next color', () => {
    animateIcon();

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000 / 60);

    for (let frame = 1; frame <= 30; frame++) scheduled.shift()!();

    expect(chrome.action.setIcon).toHaveBeenCalledTimes(31);
    // Halfway between #f857a6 and #667eea
    expect(context.colorStops.at(-2)).toEqual([0, 'rgb(175, 107, 200)']);
  });
});
