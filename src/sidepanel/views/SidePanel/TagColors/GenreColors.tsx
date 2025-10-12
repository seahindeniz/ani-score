import type { Component } from 'solid-js'
import { createMemo, createResource, Index, Show } from 'solid-js'
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
import { useSettingsStore } from '~/logic'
import { ColorPickerRow } from './ColorPickerRow'

export const GenreColors: Component = () => {
  const settingsStore = useSettingsStore()
  const [data] = createResource(fetchGenres)
  const storedGenres = createMemo(() => Object.values(settingsStore.data().genreColor).map(entry => entry.name))
  const genres = createMemo(
    () => data()?.data?.GenreCollection?.filter(
      genre => genre != null
        && !storedGenres().includes(genre),
    ) as string[] | undefined,
  )

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
            <Index each={Object.entries(settingsStore.data().genreColor)}>
              {item => (
                <ColorPickerRow
                  names={[item()[1].name, ...genres() ?? []]}
                  name={item()[1].name}
                  color={item()[1].color}
                  updateColor={(data) => {
                    if (Object.keys(data).length === 1 && data.name && data.name === item()[1].name) {
                      return
                    }

                    settingsStore.setData({
                      ...settingsStore.data(),
                      genreColor: structuredClone({
                        ...settingsStore.data().genreColor,
                        [item()[0]]: {
                          ...item()[1],
                          ...data,
                        },
                      }),
                    })
                  }}
                  resetColor={() => {
                    const newGenreColor = { ...settingsStore.data().genreColor }

                    delete newGenreColor[item()[0]]

                    settingsStore.setData({
                      ...settingsStore.data(),
                      genreColor: newGenreColor,
                    })
                  }}
                />
              )}
            </Index>
          </div>
          <Button
            onClick={() => {
              settingsStore.setData({
                ...settingsStore.data(),
                genreColor: {
                  ...settingsStore.data().genreColor,
                  [crypto.randomUUID()]: {
                    name: genres()?.[0] ?? '',
                    color: '#ffffff',
                  },
                },
              })
            }}
          >
            Add Genre
          </Button>
        </Show>
      </CardContent>
    </Card>
  )
}
