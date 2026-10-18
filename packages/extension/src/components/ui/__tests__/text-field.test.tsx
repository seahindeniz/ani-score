import { afterEach, describe, expect, it, mock } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import {
  TextField,
  TextFieldDescription,
  TextFieldErrorMessage,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea,
} from '../text-field';

afterEach(cleanup);

describe('text field', () => {
  it('renders a labelled text input with a description', () => {
    const onChange = mock();

    render(() => (
      <TextField class="root" data-testid="root" onChange={onChange}>
        <TextFieldLabel class="label">Tag name</TextFieldLabel>
        <TextFieldInput class="input" />
        <TextFieldDescription class="description">
          Lower case
        </TextFieldDescription>
      </TextField>
    ));

    const input = screen.getByLabelText('Tag name') as HTMLInputElement;

    expect(screen.getByTestId('root').className).toContain(
      'flex flex-col gap-1',
    );
    expect(screen.getByTestId('root').className).toContain('root');
    expect(input.type).toBe('text');
    expect(input.className).toContain('input');
    expect(screen.getByText('Tag name').className).toContain('label');
    expect(screen.getByText('Lower case').className).toContain(
      'text-muted-foreground',
    );
    expect(screen.getByText('Lower case').className).toContain('description');

    fireEvent.input(input, { target: { value: 'magic' } });

    expect(onChange).toHaveBeenCalledWith('magic');
  });

  it('shows the error message when invalid', () => {
    render(() => (
      <TextField validationState="invalid">
        <TextFieldLabel>Email</TextFieldLabel>
        <TextFieldInput type="email" />
        <TextFieldErrorMessage class="error">
          Invalid email
        </TextFieldErrorMessage>
      </TextField>
    ));

    const input = screen.getByLabelText('Email') as HTMLInputElement;

    expect(input.type).toBe('email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Invalid email').className).toContain(
      'text-destructive',
    );
    expect(screen.getByText('Invalid email').className).toContain('error');
  });

  it('renders a text area', () => {
    render(() => (
      <TextField>
        <TextFieldLabel>Notes</TextFieldLabel>
        <TextFieldTextArea class="area" />
      </TextField>
    ));

    const area = screen.getByLabelText('Notes');

    expect(area.tagName).toBe('TEXTAREA');
    expect(area.className).toContain('min-h-[80px]');
    expect(area.className).toContain('area');
  });
});
