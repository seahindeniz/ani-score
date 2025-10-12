import type { Component } from 'solid-js'
import { Index } from 'solid-js'
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
          <Index each={Object.entries(settingsStore.data().tagColor)}>
            {item => (
              <ColorPickerRow
                name={item()[1].name}
                color={item()[1].color}
                updateColor={(data) => {
                  if (Object.keys(data).length === 1 && data.name && data.name === item()[1].name) {
                    return
                  }

                  settingsStore.setData({
                    ...settingsStore.data(),
                    tagColor: {
                      ...settingsStore.data().tagColor,
                      [item()[0]]: {
                        ...item()[1],
                        ...data,
                      },
                    },
                  })
                }}
                resetColor={() => {
                  const newTagColor = { ...settingsStore.data().tagColor }

                  delete newTagColor[item()[0]]

                  settingsStore.setData({
                    ...settingsStore.data(),
                    tagColor: newTagColor,
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
