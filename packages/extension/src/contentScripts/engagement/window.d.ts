interface Window {
  messageGateway: typeof import('webext-bridge/content-script');
  /**
   * Set once the engagement script started on the page, which both the manifest and a site registration may inject.
   */
  aniScoreStarted?: boolean;
  /**
   * Lets the editor, a separate script, take the page over: it pauses AniScore while it shows its preview, and
   * restarts it with the saved configs when it closes.
   */
  aniScoreEngagement?: { pause: () => void; restart: () => Promise<void> };
  /**
   * True while the editor is open, so AniScore doesn't restart over its preview when configs are saved.
   */
  aniScoreEditing?: boolean;
}
