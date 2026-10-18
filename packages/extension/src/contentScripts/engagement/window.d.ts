interface Window {
  messageGateway: typeof import('webext-bridge/content-script');
  /**
   * Set once the engagement script started on the page, which both the manifest and a site registration may inject.
   */
  aniScoreStarted?: boolean;
}
