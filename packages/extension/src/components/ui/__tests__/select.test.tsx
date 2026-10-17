import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@solidjs/testing-library'
import {
  Select,
  SelectContent,
  SelectDescription,
  SelectErrorMessage,
  SelectHiddenSelect,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../select'

afterEach(cleanup)

const genres = ['Action', 'Drama', 'Fantasy']

describe('select', () => {
  it('lists the options and marks the selected one', async () => {
    render(() => (
      <Select
        options={genres}
        defaultValue="Drama"
        defaultOpen
        validationState="invalid"
        itemComponent={props => <SelectItem item={props.item} class="item">{props.item.rawValue}</SelectItem>}
      >
        <SelectLabel class="label">Genre</SelectLabel>
        <SelectHiddenSelect />
        <SelectTrigger class="trigger" aria-label="Genre">
          <SelectValue<string>>{state => state.selectedOption()}</SelectValue>
        </SelectTrigger>
        <SelectDescription class="description">Pick a genre</SelectDescription>
        <SelectErrorMessage class="error">Required</SelectErrorMessage>
        <SelectContent class="content" />
      </Select>
    ))

    const trigger = screen.getByRole('button', { name: /Genre/ })

    expect(trigger.className).toContain('rounded-md border')
    expect(trigger.className).toContain('trigger')
    expect(trigger.textContent).toContain('Drama')
    expect(screen.getByText('Genre').className).toContain('label')
    expect(screen.getByText('Pick a genre').className).toContain('text-muted-foreground')
    expect(screen.getByText('Required').className).toContain('text-destructive')

    const options = await screen.findAllByRole('option')

    expect(options.map(option => option.textContent)).toEqual(genres)
    expect(options[0].className).toContain('item')
    expect(options[1].getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('listbox').parentElement?.className).toContain('content')
  })
})
