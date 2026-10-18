import type { Component } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import MdiPlus from '~icons/mdi/plus';

import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import type { ColorEntry } from '~/logic';
import { toColorEntries, useSettingsStore } from '~/logic';

import { ColorPickerRow } from './ColorPickerRow';

export const TagColor: Component = () => {
  const settingsStore = useSettingsStore();
  const entries = createMemo(() =>
    toColorEntries(settingsStore.data().tagColor),
  );

  const setEntries = (tagColor: ColorEntry[]) => {
    settingsStore.setData({
      ...settingsStore.data(),
      tagColor,
    });
  };

  return (
    <Card class="w-full">
      <CardHeader>
        <CardTitle>Tag colors</CardTitle>
        <CardDescription>
          Give a tag a color to make it stand out in AniScore's details.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div class="flex flex-col gap-4">
          {/* Iterating ids keeps rows mounted while entries are replaced on every change; iterating the entry objects would recreate the inputs mid-edit */}
          <For each={entries().map((entry) => entry.id)}>
            {(id) => {
              const entry = () => entries().find((item) => item.id === id)!;

              return (
                <ColorPickerRow
                  name={entry().name}
                  color={entry().color}
                  updateColor={(data) => {
                    if (
                      Object.keys(data).length === 1
                      && data.name
                      && data.name === entry().name
                    ) {
                      return;
                    }

                    setEntries(
                      entries().map((item) =>
                        item.id === id ? { ...item, ...data } : item,
                      ),
                    );
                  }}
                  resetColor={() => {
                    setEntries(entries().filter((item) => item.id !== id));
                  }}
                />
              );
            }}
          </For>
        </div>
        <Show when={!entries().length}>
          <p class="m-0 text-sm text-muted-foreground">No tag colors yet.</p>
        </Show>
        <Button
          variant="outline"
          class="self-start"
          onClick={() => {
            setEntries([
              ...entries(),
              {
                id: crypto.randomUUID(),
                name: '',
                color: '#ffffff',
              },
            ]);
          }}
        >
          <MdiPlus aria-hidden="true" />
          Add tag
        </Button>
      </CardContent>
    </Card>
  );
};
