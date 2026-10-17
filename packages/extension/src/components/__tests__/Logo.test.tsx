import { describe, expect, it } from 'bun:test'
import { render } from '@solidjs/testing-library'
import Logo from '../Logo'

describe('logo component', () => {
  it('should render', () => {
    const { container } = render(() => <Logo />)

    expect(container.innerHTML).toBeTruthy()
  })
})
