import { describe, expect, it } from 'bun:test'
import { cn } from '../utils'

describe('cn', () => {
  it('joins conditional classes and lets later Tailwind classes win', () => {
    expect(cn('px-2 text-sm', false && 'hidden', { 'font-bold': true, italic: false }, 'px-4')).toBe('text-sm font-bold px-4')
  })
})
