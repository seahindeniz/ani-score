import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { useSettingsStore } from '~/logic'
import { TagColor } from '../TagColors'

const tagColor = () => useSettingsStore().data().tagColor

beforeEach(() => {
  useSettingsStore().setData({ genreColor: [], tagColor: [{ id: 'magic', name: 'magic', color: '#0000ff' }] })
})

afterEach(cleanup)

describe('tag colors', () => {
  it('adds an empty tag row', () => {
    render(() => <TagColor />)

    fireEvent.click(screen.getByRole('button', { name: 'Add Tag' }))

    expect(tagColor()).toEqual([
      { id: 'magic', name: 'magic', color: '#0000ff' },
      { id: expect.any(String), name: '', color: '#ffffff' },
    ])
    expect(screen.getAllByPlaceholderText('Enter tag name')).toHaveLength(2)
  })

  it('renames and recolors a tag', () => {
    render(() => <TagColor />)

    const name = screen.getByPlaceholderText('Enter tag name') as HTMLInputElement

    name.value = 'Elf'
    fireEvent.input(name)

    const color = document.querySelector<HTMLInputElement>('input[type="color"]')!

    color.value = '#00ff00'
    fireEvent.input(color)

    expect(tagColor()).toEqual([{ id: 'magic', name: 'elf', color: '#00ff00' }])
  })

  it('ignores a rename to the same name', () => {
    render(() => <TagColor />)

    const before = tagColor()
    const name = screen.getByPlaceholderText('Enter tag name') as HTMLInputElement

    name.value = 'MAGIC'
    fireEvent.input(name)

    expect(tagColor()).toBe(before)
  })

  it('removes a tag', () => {
    render(() => <TagColor />)

    fireEvent.click(screen.getAllByRole('button')[0])

    expect(tagColor()).toEqual([])
    expect(screen.queryByPlaceholderText('Enter tag name')).toBeNull()
  })
})
