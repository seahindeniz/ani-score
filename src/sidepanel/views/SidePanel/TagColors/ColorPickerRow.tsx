import type { Component } from 'solid-js'
import type { ColorEntry } from '~/logic'
import { Show } from 'solid-js'
import AntDesignCloseOutlined from '~icons/ant-design/close-outlined'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { TextField, TextFieldInput } from '~/components/ui/text-field'

interface Props {
  name: string
  color: string
  names?: string[]
  updateColor: (data: Partial<ColorEntry>) => void
  resetColor: () => void
}

export const ColorPickerRow: Component<Props> = (props) => {
  return (
    <div class="flex items-center justify-between gap-3">
      <Show
        when={props.names}
        fallback={(
          <TextField>
            <TextFieldInput
              value={props.name}
              type="text"
              placeholder="Enter tag name"
              onInput={e => (props.updateColor({ name: e.currentTarget.value }))}
            />
          </TextField>
        )}
      >
        <Select
          options={props.names!}
          class="flex-grow-1"
          placeholder="Select"
          value={props.name}
          onChange={value => (props.updateColor({ name: value! }))}
          itemComponent={props => (
            <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
          )}
        >
          <SelectTrigger>
            <SelectValue<string>>{state => state.selectedOption()}</SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      </Show>
      <Avatar>
        <AvatarFallback>
          <input
            list="presetColors"
            class="h-full w-full"
            type="color"
            value={props.color}
            onInput={e => props.updateColor({ color: e.currentTarget.value })}
          />
          <datalist id="presetColors">
            <option>#fe4848</option>
            <option>#00ff00</option>
            <option>#ffdd00</option>
          </datalist>
        </AvatarFallback>
      </Avatar>
      <Button onClick={props.resetColor} variant="destructive" size="icon" class="min-w-[40px]"><AntDesignCloseOutlined /></Button>
    </div>
  )
}
