import type { Component } from 'solid-js'
import type { ColorEntry } from '~/logic'
import { createMemo, createResource, For, Show } from 'solid-js'
import LineMdLoadingLoop from '~icons/line-md/loading-loop'
import { fetchGenres } from '~/background/logic/fetchGenres'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { toColorEntries, useSettingsStore } from '~/logic'
import { ColorPickerRow } from './ColorPickerRow'

export const GenreColors: Component = () => {
  const settingsStore = useSettingsStore()
  const [data] = createResource(fetchGenres)
  const entries = createMemo(() => toColorEntries(settingsStore.data().genreColor))
  const storedGenres = createMemo(() => entries().map(entry => entry.name))
  const genres = createMemo(
    () => data()?.data?.GenreCollection?.filter(
      genre => genre != null
        && !storedGenres().includes(genre),
    ) as string[] | undefined,
  )

  const setEntries = (genreColor: ColorEntry[]) => {
    settingsStore.setData({
      ...settingsStore.data(),
      genreColor,
    })
  }

  return (
    <Card class="w-xs">
      <CardHeader>
        <CardTitle>Genre Colors</CardTitle>
        <CardDescription>Customize the color for each genre.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-7">
        <Show
          when={data() && settingsStore.data()}
          fallback={(
            <div class="flex items-center justify-center">
              <LineMdLoadingLoop class="size-10 animate-spin" />
            </div>
          )}
        >
          <div class="flex flex-col gap-4">
            {/* Iterating ids keeps rows mounted while entries are replaced on every change; iterating the entry objects would recreate the color input mid-drag */}
            <For each={entries().map(entry => entry.id)}>
              {(id) => {
                const entry = () => entries().find(item => item.id === id)!

                return (
                  <ColorPickerRow
                    names={[entry().name, ...genres() ?? []]}
                    name={entry().name}
                    color={entry().color}
                    updateColor={(data) => {
                      if (Object.keys(data).length === 1 && data.name && data.name === entry().name) {
                        return
                      }

                      setEntries(entries().map(item => item.id === id ? { ...item, ...data } : item))
                    }}
                    resetColor={() => {
                      setEntries(entries().filter(item => item.id !== id))
                    }}
                  />
                )
              }}
            </For>
          </div>
          <Button
            onClick={() => {
              setEntries([
                ...entries(),
                {
                  id: crypto.randomUUID(),
                  name: genres()?.[0] ?? '',
                  color: '#ffffff',
                },
              ])
            }}
          >
            Add Genre
          </Button>
        </Show>
      </CardContent>
    </Card>
  )
}
