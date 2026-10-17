import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@solidjs/testing-library'
import { Badge, badgeVariants } from '../badge'

afterEach(cleanup)

describe('badge', () => {
  it('uses the default variant', () => {
    render(() => <Badge>New</Badge>)

    const badge = screen.getByText('New')

    expect(badge.className).toContain('bg-primary')
    expect(badge.className).not.toContain('rounded-full')
  })

  it('applies the variant, round shape and extra classes', () => {
    render(() => <Badge variant="error" round class="extra" data-testid="badge">Failed</Badge>)

    const badge = screen.getByTestId('badge')

    expect(badge.className).toContain('bg-error')
    expect(badge.className).toContain('rounded-full')
    expect(badge.className).toContain('extra')
    expect(badge.textContent).toBe('Failed')
  })

  it('exposes the variant classes', () => {
    expect(badgeVariants({ variant: 'outline' })).toContain('text-foreground')
  })
})
