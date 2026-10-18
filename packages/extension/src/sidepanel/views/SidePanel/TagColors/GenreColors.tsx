import type { Component } from 'solid-js';
import { createMemo, createResource, For, Show } from 'solid-js';
import LineMdLoadingLoop from '~icons/line-md/loading-loop';
import MdiPlus from '~icons/mdi/plus';

import { fetchGenres } from '~/background/logic/fetchGenres';
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

export const GenreColors: Component = () => {
  const settingsStore = useSettingsStore();
  const [data] = createResource(fetchGenres);
  const entries = createMemo(() =>
    toColorEntries(settingsStore.data().genreColor),
  );
  const storedGenres = createMemo(() => entries().map((entry) => entry.name));
  const genres = createMemo(
    () =>
      data()?.data?.GenreCollection?.filter(
        (genre) => genre != null && !storedGenres().includes(genre),
      ) as string[] | undefined,
  );

  const setEntries = (genreColor: ColorEntry[]) => {
    settingsStore.setData({
      ...settingsStore.data(),
      genreColor,
    });
  };

  return (
    <Card class="w-full">
      <CardHeader>
        <CardTitle>Genre colors</CardTitle>
        <CardDescription>
          Give a genre a color to make it stand out in AniScore's details.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <Show
          when={data() && settingsStore.data()}
          fallback={
            <div class="flex items-center justify-center">
              <LineMdLoadingLoop class="size-10 animate-spin" />
            </div>
          }
        >
          <div class="flex flex-col gap-4">
            {/* Iterating ids keeps rows mounted while entries are replaced on every change; iterating the entry objects would recreate the color input mid-drag */}
            <For each={entries().map((entry) => entry.id)}>
              {(id) => {
                const entry = () => entries().find((item) => item.id === id)!;

                return (
                  <ColorPickerRow
                    names={[entry().name, ...(genres() ?? [])]}
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
            <p class="m-0 text-sm text-muted-foreground">
              No genre colors yet.
            </p>
          </Show>
          <Button
            variant="outline"
            class="self-start"
            onClick={() => {
              setEntries([
                ...entries(),
                {
                  id: crypto.randomUUID(),
                  name: genres()?.[0] ?? '',
                  color: '#ffffff',
                },
              ]);
            }}
          >
            <MdiPlus aria-hidden="true" />
            Add genre
          </Button>
        </Show>
      </CardContent>
    </Card>
  );
};
