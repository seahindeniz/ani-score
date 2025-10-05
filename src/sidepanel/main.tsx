import { Route, Router } from '@solidjs/router'
import { render } from 'solid-js/web'
import { SidePanel } from './views/SidePanel/SidePanel'
import { TokenReceived } from './views/TokenReceived'
import '../styles'

function transformUrl() {
  const url = location.href
  const processed = url.replace(/.*?\.html/, '')

  if (!processed) {
    return '/'
  }

  const hashIndex = processed.indexOf('#')
  const mainPart = hashIndex !== -1 ? processed.substring(0, hashIndex) : processed
  const hashPart = hashIndex !== -1 ? processed.substring(hashIndex) : ''

  if (!mainPart) {
    return `/${hashPart}`
  }

  const segments = mainPart.split('?').filter(segment => segment !== '')

  if (segments.length === 0) {
    return `/${hashPart}`
  }

  if (segments.length === 1) {
    const segment = segments[0]

    return `/${segment.includes('=') ? '?' : ''}${segment}${hashPart}`
  }

  const pathSegment = segments[0]
  const querySegments = segments.slice(1)
  const queryString = querySegments.join('&')

  return `/${pathSegment}?${queryString}${hashPart}`
}

const root = document.getElementById('app')

if (root) {
  render(() => (
    <Router transformUrl={() => transformUrl()}>
      <Route path="/" component={SidePanel} />
      <Route path="/auth/*" component={TokenReceived} />
    </Router>
  ), root)
}
