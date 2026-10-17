import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen } from '@solidjs/testing-library'
import App from '../App'

describe('widget App', () => {
  it('toggles the panel with the button', () => {
    render(() => <App />)

    const panel = screen.getByText('Vitesse WebExt1').parentElement!

    expect(panel.style.display).toBe('none')
    expect(panel.classList.contains('opacity-0')).toBe(true)

    fireEvent.click(screen.getByRole('button'))

    expect(panel.style.display).toBe('block')
    expect(panel.classList.contains('opacity-100')).toBe(true)

    fireEvent.click(screen.getByRole('button'))

    expect(panel.style.display).toBe('none')
  })
})
