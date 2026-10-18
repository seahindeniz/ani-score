import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';

import type { SiteCard } from '~/sites/schema';

import { cardElements } from '../../../logic/detect';
import { renderInEditor } from '../../__tests__/harness';
import type { CardPartProps } from '../types';

/**
 * Renders a card part on the page's cards, keeping the card it changes.
 */
export function renderCardPart(
  Part: Component<CardPartProps>,
  initial: SiteCard,
  options: Pick<CardPartProps, 'advanced' | 'autoPick'> = {},
  picks: Element[] = [],
) {
  const [card, setCard] = createSignal(initial);
  const result = renderInEditor(
    () => (
      <Part
        card={card()}
        onChange={setCard}
        elements={() => cardElements(card())}
        {...options}
      />
    ),
    picks,
  );

  return { ...result, card, setCard };
}
