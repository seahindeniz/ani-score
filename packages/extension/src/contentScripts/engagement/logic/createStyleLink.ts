export function createStyleLink(scope: string) {
  const styleEl = document.createElement('link')

  styleEl.setAttribute('rel', 'stylesheet')
  styleEl.setAttribute('href', browser.runtime.getURL(`dist/contentScripts/${scope}/style.css`))

  return styleEl
}
