import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../accordion'

afterEach(cleanup)

describe('accordion', () => {
  it('expands an item when its trigger is clicked', async () => {
    render(() => (
      <Accordion>
        <AccordionItem value="genres" class="item" data-testid="item">
          <AccordionTrigger class="trigger">Genres</AccordionTrigger>
          <AccordionContent class="content">Adventure</AccordionContent>
        </AccordionItem>
      </Accordion>
    ))

    const trigger = screen.getByRole('button', { name: 'Genres' })

    expect(screen.getByTestId('item').className).toContain('border-b')
    expect(screen.getByTestId('item').className).toContain('item')
    expect(trigger.className).toContain('trigger')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Adventure')).toBeNull()

    fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    const content = await screen.findByRole('region')

    expect(content.textContent).toBe('Adventure')
    expect(content.className).toContain('content')
  })
})
