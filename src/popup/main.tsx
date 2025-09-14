import { render } from 'solid-js/web'
import Popup from './Popup'
import '../styles'

const root = document.getElementById('app')
if (root) {
  render(() => <Popup />, root)
}
