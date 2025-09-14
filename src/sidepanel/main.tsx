import { render } from 'solid-js/web'
import Sidepanel from './Sidepanel'
import '../styles'

const root = document.getElementById('app')

if (root) {
  render(() => <Sidepanel />, root)
}
