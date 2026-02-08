import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import Logo from '../Logo'

describe('logo component', () => {
  it('should render', () => {
    const { container } = render(() => <Logo />)

    expect(container.innerHTML).toBeTruthy()
  })
})
