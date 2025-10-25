import { logger } from '~/utils/logger'
import { liveInterval } from '../../constants/main'
import style from '../../styles/background.css?url'

export function fetchCSS() {
  setInterval(() => {
    fetch(browser.runtime.getURL(style))
      .then(response => response.text())
      .catch((error) => {
        logger.error('Failed to fetch CSS:', error)
      })
  }, liveInterval)
}
