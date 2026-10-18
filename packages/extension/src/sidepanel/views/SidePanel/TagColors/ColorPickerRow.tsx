import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import AntDesignCloseOutlined from '~icons/ant-design/close-outlined';

import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { TextField, TextFieldInput } from '~/components/ui/text-field';
import type { ColorEntry } from '~/logic';

interface Props {
  name: string;
  color: string;
  names?: string[];
  updateColor: (data: Partial<ColorEntry>) => void;
  resetColor: () => void;
}

export const ColorPickerRow: Component<Props> = (props) => {
  return (
    <div class="flex items-center justify-between gap-3">
      <Show
        when={props.names}
        fallback={
          <TextField class="flex-1">
            <TextFieldInput
              value={props.name}
              type="text"
              placeholder="Tag name"
              aria-label="Tag"
              onInput={(e) =>
                props.updateColor({ name: e.currentTarget.value.toLowerCase() })
              }
            />
          </TextField>
        }
      >
        <For each={[props.name]}>
          {(name) => (
            <Select
              options={props.names!}
              class="flex-grow-1"
              placeholder="Select"
              // Picking the current option again would otherwise deselect it, leaving the row without a name
              disallowEmptySelection
              value={name}
              onChange={(value) => props.updateColor({ name: value! })}
              itemComponent={(props) => (
                <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
              )}
            >
              {/* Read with the chosen genre: "Genre, Action" */}
              <SelectLabel class="sr-only">Genre</SelectLabel>
              <SelectTrigger>
                <SelectValue<string>>
                  {(state) => state.selectedOption()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          )}
        </For>
      </Show>
      <Avatar>
        <AvatarFallback>
          <input
            list="presetColors"
            class="h-full w-full cursor-pointer"
            type="color"
            aria-label={`Color for ${props.name || 'this tag'}`}
            value={props.color}
            onInput={(e) => props.updateColor({ color: e.currentTarget.value })}
          />
          <datalist id="presetColors">
            <option>#fe4848</option>
            <option>#00ff00</option>
            <option>#ffdd00</option>
          </datalist>
        </AvatarFallback>
      </Avatar>
      {/* Quiet until pointed at: a red button on every row outweighs the colors themselves */}
      <Button
        onClick={props.resetColor}
        variant="ghost"
        size="icon"
        class="min-w-[40px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Remove ${props.name ? `the ${props.name} color` : 'this color'}`}
      >
        <AntDesignCloseOutlined aria-hidden="true" />
      </Button>
    </div>
  );
};
