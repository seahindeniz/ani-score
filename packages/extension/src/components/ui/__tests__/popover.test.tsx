import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { Popover, PopoverContent, PopoverTrigger } from '../popover'

afterEach(cleanup)

describe('popover', () => {
  it('opens its content when the trigger is clicked', async () => {
    render(() => (
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent class="extra">Popover content</PopoverContent>
      </Popover>
    ))

    expect(screen.queryByText('Popover content')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    const content = await screen.findByText('Popover content')

    expect(content.className).toContain('w-72')
    expect(content.className).toContain('extra')
  })
})
