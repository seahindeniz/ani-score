import type { Component } from 'solid-js'
import { For } from 'solid-js'
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

export const TagColor: Component = () => {
  const settingsStore = useSettingsStore()

  return (
    <Card class="w-xs">
      <CardHeader>
        <CardTitle>Tag Colors</CardTitle>
        <CardDescription>Customize the color for each tag.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-7">
        <div class="flex flex-col gap-4">
          <For each={Object.keys(settingsStore.data().tagColor)}>
            {(key) => {
              const entry = () => settingsStore.data().tagColor[key]

              return (
                <ColorPickerRow
                  name={entry().name}
                  color={entry().color}
                  updateColor={(data) => {
                    if (Object.keys(data).length === 1 && data.name && data.name === entry().name) {
                      return
                    }

                    settingsStore.setData({
                      ...settingsStore.data(),
                      tagColor: {
                        ...settingsStore.data().tagColor,
                        [key]: {
                          ...entry(),
                          ...data,
                        },
                      },
                    })
                  }}
                  resetColor={() => {
                    const newTagColor = { ...settingsStore.data().tagColor }

                    delete newTagColor[key]

                    settingsStore.setData({
                      ...settingsStore.data(),
                      tagColor: newTagColor,
                    })
                  }}
                />
              )
            }}
          </For>
        </div>
        <Button
          onClick={() => {
            settingsStore.setData({
              ...settingsStore.data(),
              tagColor: {
                ...settingsStore.data().tagColor,
                [crypto.randomUUID()]: {
                  name: '',
                  color: '#ffffff',
                },
              },
            })
          }}
        >
          Add Tag
        </Button>
      </CardContent>
    </Card>
  )
}
