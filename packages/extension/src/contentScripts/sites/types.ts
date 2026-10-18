export interface EpisodeCard {
  element: HTMLElement;
  /**
   * What the anime is looked up by: the card's title, plus " Season N" from the second season on.
   */
  title: string;
  episodeNumber?: number;
  render: (container: HTMLElement) => void;
  /**
   * Element within the episode card to apply "watching" state styles to.
   */
  shimmeringElement: HTMLElement | null;
}
