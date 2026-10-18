import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SiteConfig } from '~/sites/schema';

import { newDraft } from '../../logic/draft';
import { Setup, setupSteps } from '../Setup';
import { cardSpec, episodeGrid, renderInEditor, settle } from './harness';

const stepIndex = (id: string) =>
  setupSteps.findIndex((step) => step.id === id);

function setUp(
  initial: SiteConfig,
  options: { step?: number; picks?: Element[] } = {},
) {
  const [config, setConfig] = createSignal(initial);
  const [step, setStep] = createSignal(options.step ?? 0);
  const handlers = {
    onSave: mock(async (_: SiteConfig) => {}),
    onOpenEditor: mock(),
    onClose: mock(),
    onMove: mock(),
  };
  const result = renderInEditor(
    () => (
      <Setup
        config={config()}
        onChange={setConfig}
        step={step()}
        onStep={setStep}
        position={undefined}
        {...handlers}
      />
    ),
    options.picks,
  );

  return { ...result, ...handlers, config, step };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
const progress = () =>
  screen.getByRole('progressbar').getAttribute('aria-valuenow');
const card = (config: SiteConfig) => config.pages[0].cards[0];

// A setup up to the review, as the guided steps leave it
const complete = (): SiteConfig => {
  const draft = newDraft(location);

  return {
    ...draft,
    theme: 'dark',
    pages: [
      {
        ...draft.pages[0],
        cards: [
          cardSpec({
            selector: 'div.episodes > div.cell',
            episode: {
              selector: 'span',
              steps: [{ match: '(\\d+)\\.\\s*Bölüm' }],
            },
            inject: { selector: 'h3', position: 'after' },
          }),
        ],
      },
    ],
  };
};

afterEach(cleanup);

describe('Setup', () => {
  it('asks for one thing at a time, from the cards to where the score goes', async () => {
    const cards = episodeGrid();
    const { config, step } = setUp(newDraft(location), {
      picks: [
        cards[0].querySelector('h3')!,
        cards[1].querySelector('h3')!,
        cards[2].querySelector('span')!,
      ],
    });

    expect(heading()).toBe('Find the episode cards');
    expect(progress()).toBe('1');
    expect(screen.getByText('Step 1 of 7')).toBeTruthy();
    expect(button('Next').hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    await settle();
    fireEvent.click(button('Next'));

    expect(heading()).toBe("Pick the anime's name");
    expect(button('Next').hasAttribute('disabled')).toBe(true);

    await settle();
    fireEvent.click(button('Next'));

    expect(heading()).toBe('Pick the episode number');
    expect(button('No episodes here')).toBeTruthy();

    await settle();

    expect(
      screen.queryByRole('button', { name: 'No episodes here' }),
    ).toBeNull();

    fireEvent.click(button('Next'));

    // The score goes under the name unless the user says otherwise
    expect(heading()).toBe('Choose where the score goes');
    expect(card(config()).inject).toEqual({
      selector: 'h3',
      position: 'after',
    });

    fireEvent.click(screen.getByRole('radio', { name: /End of the card/ }));
    fireEvent.click(button('Next'));

    expect(heading()).toBe("Match the site's colors");
    expect(screen.getByText('Optional')).toBeTruthy();
    expect(config().theme).toBe('light');
    expect(
      screen.getByText(
        'The score uses dark or light colors. AniScore picked light because this site looks light.',
      ),
    ).toBeTruthy();

    // Back and forth keeps the user's choice of spot
    fireEvent.click(button('Back'));
    fireEvent.click(button('Next'));

    expect(card(config()).inject).toEqual({ position: 'append' });
    expect(step()).toBe(stepIndex('colors'));
  });

  it('moves with its header', () => {
    episodeGrid();

    const { onMove } = setUp(complete(), { step: stepIndex('review') });

    fireEvent.keyDown(button(/^Move the panel/) as HTMLElement, {
      key: 'ArrowUp',
    });

    expect(onMove).toHaveBeenCalled();
  });

  it('skips the optional steps, setting nothing for them', () => {
    episodeGrid();

    const initial = complete();

    initial.pages[0].layout = [
      { container: 'div.episodes', mode: 'grid', gap: 30 },
    ];
    initial.pages[0].cards[0].shimmer = {};

    const { config } = setUp(initial, { step: stepIndex('colors') });

    fireEvent.click(button('Skip'));

    expect(heading()).toBe('Highlight anime on your list');
    expect(config().theme).toBe('dark');

    fireEvent.input(screen.getByRole('slider'), { target: { value: '40' } });

    expect(config().pages[0].layout).toEqual([
      { container: 'div.episodes', mode: 'grid', gap: 40 },
    ]);

    fireEvent.click(button('Skip'));

    expect(heading()).toBe('Check and save');
    expect(card(config()).shimmer).toBeUndefined();
    expect(config().pages[0].layout).toBeUndefined();
  });

  it('goes on without an episode on sites that show none', () => {
    episodeGrid();

    const initial = complete();

    initial.pages[0].cards[0].season = { selector: 'span' };

    const { config } = setUp(
      {
        ...initial,
        pages: [
          {
            ...initial.pages[0],
            cards: [{ ...card(initial), episode: undefined }],
          },
        ],
      },
      { step: stepIndex('episode') },
    );

    fireEvent.click(button('No episodes here'));

    expect(heading()).toBe('Choose where the score goes');
    expect(card(config())).not.toHaveProperty('season', expect.anything());
  });

  it('reviews the setup, saves it, and offers to share it or open the editor', async () => {
    episodeGrid();

    const { config, onSave, onOpenEditor, onClose } = setUp(complete(), {
      step: stepIndex('review'),
    });
    const open = spyOn(window, 'open').mockImplementation(() => null);

    expect(heading()).toBe('Check and save');
    expect(
      screen.getByText(
        'Everything reads correctly. Change anything that looks wrong.',
      ),
    ).toBeTruthy();
    expect(
      Array.from(screen.getAllByRole('term'), (term) => term.textContent),
    ).toEqual([
      'Episode cards',
      'Name',
      'Episode',
      'Score',
      'Colors',
      'Highlight and spacing',
    ]);
    expect(screen.getAllByRole('definition')[0].textContent).toBe(
      '5 on this page',
    );
    expect(
      screen.getByRole('radiogroup', { name: 'Show scores on' }),
    ).toBeTruthy();

    fireEvent.click(button('Change colors'));

    expect(heading()).toBe("Match the site's colors");

    fireEvent.click(screen.getByRole('radio', { name: /Follow the site's/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Light/ }));

    expect(config().theme).toBe('light');

    for (let at = stepIndex('colors'); at < stepIndex('review'); at++) {
      fireEvent.click(button('Next'));
    }

    fireEvent.click(button('Save'));
    await settle();

    expect(onSave).toHaveBeenCalledWith(config());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'example.com is set up',
    );
    expect(screen.queryByRole('progressbar')).toBeNull();

    fireEvent.click(button('Share with everyone'));
    await settle();

    expect(open).toHaveBeenCalled();
    expect(
      screen.getByText(/^Opened a GitHub issue with the setup/),
    ).toBeTruthy();

    fireEvent.click(button('Open the editor'));
    fireEvent.click(button('Done'));

    expect(onOpenEditor).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    open.mockRestore();
  });

  it("says what's wrong when the setup can't be saved, and what doesn't read", async () => {
    episodeGrid();

    const { onSave } = setUp(
      { ...complete(), id: '' },
      { step: stepIndex('review') },
    );

    fireEvent.click(screen.getByRole('radio', { name: /Every page/ }));
    fireEvent.click(button('Save'));
    await settle();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toStartWith(
      "Can't save yet:",
    );

    cleanup();
    episodeGrid();
    setUp(
      {
        ...complete(),
        pages: [
          { ...complete().pages[0], cards: [cardSpec({ selector: '.none' })] },
        ],
      },
      { step: stepIndex('review') },
    );

    expect(screen.getByText('Change anything that looks wrong.')).toBeTruthy();
  });
});
