import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@solidjs/testing-library'
import { Label } from '../label'

afterEach(cleanup)

describe('label', () => {
  it('renders a label tied to its input', () => {
    render(() => (
      <>
        <Label for="name" class="extra">Name</Label>
        <input id="name" />
      </>
    ))

    const label = screen.getByText('Name')

    expect(label.tagName).toBe('LABEL')
    expect(label.getAttribute('for')).toBe('name')
    expect(label.className).toContain('text-sm font-medium')
    expect(label.className).toContain('extra')
  })
})
