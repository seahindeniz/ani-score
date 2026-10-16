import type { Component } from 'solid-js'
import type { ColorEntry } from '~/logic'
import { createMemo, For } from 'solid-js'
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

export const TagColor: Component = () => {
  const settingsStore = useSettingsStore()
  const entries = createMemo(() => toColorEntries(settingsStore.data().tagColor))

  const setEntries = (tagColor: ColorEntry[]) => {
    settingsStore.setData({
      ...settingsStore.data(),
      tagColor,
    })
  }

  return (
    <Card class="w-xs">
      <CardHeader>
        <CardTitle>Tag Colors</CardTitle>
        <CardDescription>Customize the color for each tag.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-7">
        <div class="flex flex-col gap-4">
          {/* Iterating ids keeps rows mounted while entries are replaced on every change; iterating the entry objects would recreate the inputs mid-edit */}
          <For each={entries().map(entry => entry.id)}>
            {(id) => {
              const entry = () => entries().find(item => item.id === id)!

              return (
                <ColorPickerRow
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
                name: '',
                color: '#ffffff',
              },
            ])
          }}
        >
          Add Tag
        </Button>
      </CardContent>
    </Card>
  )
}
