import type { Component } from 'solid-js'
import { debounce } from '@solid-primitives/scheduled'
import { createMemo, createResource, For, Show } from 'solid-js'
import { fetchGenres } from '~/background/logic/fetchGenres'
import { useSettingsStore } from '~/logic'
import style from './GenreColor.module.scss'

export const GenreColor: Component = () => {
  const settingsStore = useSettingsStore()
  const [data] = createResource(fetchGenres)
  const genres = createMemo(() => data()?.data?.GenreCollection?.filter(genre => genre != null))

  const handleInput = debounce((color: string, genre: string) => {
    settingsStore.setData({
      ...settingsStore.data(),
      genreColor: {
        ...settingsStore.data().genreColor,
        [genre]: color,
      },
    })
  }, 300)

  const resetColor = (genre: string) => {
    const newGenreColor = { ...settingsStore.data().genreColor }

    delete newGenreColor[genre]

    settingsStore.setData({
      ...settingsStore.data(),
      genreColor: newGenreColor,
    })
  }

  return (
    <div class={style.container}>
      <For each={genres()}>
        {genre => (
          <div class={style.row}>
            <div class={style.title}>{genre}</div>
            <input
              type="color"
              value={settingsStore.data().genreColor?.[genre] ?? '#ffffff'}
              onInput={event => handleInput((event.target as HTMLInputElement).value, genre)}
            />
            <Show when={settingsStore.data().genreColor?.[genre]} fallback={<span />}>
              <button onClick={() => resetColor(genre)}>X</button>
            </Show>
          </div>
        )}
      </For>
    </div>
  )
}
