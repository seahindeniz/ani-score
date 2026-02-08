import { render } from 'solid-js/web'
import Options from './Options'
import '../styles'

const root = document.getElementById('app')
if (root) {
  render(() => <Options />, root)
}
