import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@solidjs/testing-library'
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip'

afterEach(cleanup)

describe('tooltip', () => {
  it('renders the open tooltip content', async () => {
    render(() => (
      <Tooltip open>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent class="extra">Tooltip text</TooltipContent>
      </Tooltip>
    ))

    const content = await screen.findByRole('tooltip')

    expect(content.textContent).toBe('Tooltip text')
    expect(content.className).toContain('px-3 py-1.5')
    expect(content.className).toContain('extra')
  })
})
