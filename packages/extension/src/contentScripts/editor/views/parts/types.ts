import type { SiteCard } from '~/sites/schema';

export interface CardPartProps {
  card: SiteCard;
  onChange: (card: SiteCard) => void;
  /**
   * The cards on the page, as the card's selector finds them now.
   */
  elements: () => HTMLElement[];
  /**
   * Shows the settings behind the guided controls. The editor does, the guided setup doesn't.
   */
  advanced?: boolean;
  /**
   * Starts picking right away while nothing is picked yet. The guided setup does.
   */
  autoPick?: boolean;
}

/**
 * How a part of the setup does on the page: fine, worth a look, or nothing to say.
 */
export type Status = 'ok' | 'issue' | 'none';

export interface Summary {
  text: string;
  status: Status;
}

export const cardCount = (count: number) =>
  count === 1 ? '1 card' : `${count} cards`;
