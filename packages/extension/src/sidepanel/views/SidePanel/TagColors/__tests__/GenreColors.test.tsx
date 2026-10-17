import type { ColorEntry } from '~/logic'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { useSettingsStore } from '~/logic'
import { GenreColors } from '../GenreColors'

const originalFetch = globalThis.fetch
const genreColor = () => useSettingsStore().data().genreColor as ColorEntry[]

function choose(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.click(trigger)
}

async function pick(name: string) {
  const option = await screen.findByRole('option', { name })

  fireEvent.pointerDown(option, { button: 0, pointerType: 'mouse' })
  fireEvent.pointerUp(option, { button: 0, pointerType: 'mouse' })
  fireEvent.click(option)
}

beforeAll(() => {
  globalThis.fetch = (async () => Response.json({ data: { GenreCollection: ['Action', 'Drama', null] } })) as unknown as typeof fetch
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

beforeEach(() => {
  useSettingsStore().setData({ genreColor: [{ id: 'drama', name: 'Drama', color: '#ff0000' }], tagColor: [] })
})

afterEach(cleanup)

describe('genre colors', () => {
  it('loads AniList genres, then adds the first one without a color yet', async () => {
    render(() => <GenreColors />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add Genre' }))

    expect(genreColor()).toEqual([
      { id: 'drama', name: 'Drama', color: '#ff0000' },
      { id: expect.any(String), name: 'Action', color: '#ffffff' },
    ])
  })

  it('adds an unnamed row once every genre has a color', async () => {
    useSettingsStore().setData({
      genreColor: [{ id: 'drama', name: 'Drama', color: '#ff0000' }, { id: 'action', name: 'Action', color: '#00ff00' }],
      tagColor: [],
    })
    render(() => <GenreColors />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add Genre' }))

    expect(genreColor().at(-1)).toEqual({ id: expect.any(String), name: '', color: '#ffffff' })
  })

  it('switches a row to another genre and recolors it', async () => {
    render(() => <GenreColors />)

    choose(await screen.findByRole('button', { name: /Drama/ }))
    await pick('Action')
    expect(genreColor()).toEqual([{ id: 'drama', name: 'Action', color: '#ff0000' }])

    const color = document.querySelector<HTMLInputElement>('input[type="color"]')!

    color.value = '#123456'
    fireEvent.input(color)
    expect(genreColor()).toEqual([{ id: 'drama', name: 'Action', color: '#123456' }])
  })

  it('removes a row', async () => {
    render(() => <GenreColors />)

    await screen.findByRole('button', { name: 'Add Genre' })
    fireEvent.click(document.querySelector<HTMLButtonElement>('button.min-w-\\[40px\\]')!)

    expect(genreColor()).toEqual([])
  })
})
