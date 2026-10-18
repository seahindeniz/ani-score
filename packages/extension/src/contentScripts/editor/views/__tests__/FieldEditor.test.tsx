import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SiteField } from '~/sites/schema';

import { useEditor } from '../context';
import { FieldEditor } from '../FieldEditor';
import { chooseOption, renderInEditor, settle } from './harness';

function cards() {
  document.body.innerHTML = `
    <a class="card" href="/anime/frieren/2/5"><h3>Frieren</h3><p>Sezon 2 <b>new</b></p></a>
    <a class="card" href="/anime/dandadan/1/12"><h3>Dandadan</h3><p>12. Bölüm</p></a>
    <a class="card" href="/anime/other"><h3></h3></a>`;

  return Array.from(document.querySelectorAll<HTMLElement>('.card'));
}

function setUp(
  initial: SiteField | undefined,
  options: { optional?: boolean; numeric?: boolean } = {},
) {
  const elements = cards();
  const [field, setField] = createSignal(initial);
  const result = renderInEditor(() => (
    <FieldEditor
      label="Episode"
      field={field()}
      onChange={setField}
      cards={() => elements}
      {...options}
    />
  ));

  return { ...result, field, elements };
}

const read = () =>
  Array.from(
    screen.getByRole('list', { name: 'Episode on the first cards' }).children,
    (item) => item.textContent,
  );

afterEach(cleanup);

describe('FieldEditor', () => {
  it('shows what it reads from the first cards', () => {
    setUp({ selector: 'h3' });

    expect(read()).toEqual(['Frieren', 'Dandadan', 'Nothing read']);
  });

  it('reads numbers when the value is one', () => {
    setUp(
      { source: { attr: 'href' }, steps: [{ match: '/(\\d+)$' }] },
      {
        numeric: true,
      },
    );

    expect(read()).toEqual(['5', '12', 'Nothing read']);
  });

  it('reads the elements the user types or picks', async () => {
    const { field, willPick, elements } = setUp({});

    fireEvent.input(screen.getByRole('textbox', { name: /^Element/ }), {
      target: { value: 'p' },
    });

    expect(field()).toEqual({ selector: 'p' });

    willPick(elements[1].querySelector('h3')!);
    fireEvent.click(screen.getByRole('button', { name: 'Pick the element' }));
    await settle();

    expect(field()).toEqual({ selector: 'h3' });

    // The card itself, and a cancelled pick
    willPick(elements[0], undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Pick the element' }));
    await settle();

    expect(field()).toEqual({});

    fireEvent.click(screen.getByRole('button', { name: 'Pick the element' }));
    await settle();

    expect(field()).toEqual({});

    // Outside the cards nothing is picked
    willPick(document.body);
    fireEvent.click(screen.getByRole('button', { name: 'Pick the element' }));
    await settle();

    expect(field()).toEqual({});
  });

  it('reads text, own text or an attribute', () => {
    const { field } = setUp({ selector: 'p' });
    const source = () => screen.getByRole('combobox', { name: 'Read' });

    chooseOption(source(), 'Own text (without child elements)');
    expect(field()).toEqual({ selector: 'p', source: 'ownText' });
    expect(read()[0]).toBe('Sezon 2');

    chooseOption(source(), 'Attribute');
    expect(field()).toEqual({ selector: 'p', source: { attr: 'href' } });

    fireEvent.input(screen.getByRole('textbox', { name: 'Attribute' }), {
      target: { value: 'title' },
    });
    expect(field()).toEqual({ selector: 'p', source: { attr: 'title' } });

    chooseOption(source(), 'Text');
    expect(field()).toEqual({ selector: 'p', source: undefined });
  });

  it('adds ready-made and custom steps, and edits them', () => {
    const { field } = setUp({ selector: 'p' });
    const addStep = (option: string) =>
      chooseOption(
        screen.getByRole('combobox', { name: 'Add a step' }),
        option,
      );

    addStep('First number');
    expect(field()).toEqual({ selector: 'p', steps: [{ match: '(\\d+)' }] });

    fireEvent.input(screen.getByRole('textbox', { name: 'Expression' }), {
      target: { value: 'Sezon (\\d+)' },
    });
    fireEvent.input(screen.getByRole('textbox', { name: 'Flags' }), {
      target: { value: 'i' },
    });
    fireEvent.input(screen.getByRole('spinbutton', { name: 'Group' }), {
      target: { value: '0' },
    });
    expect(field()).toEqual({
      selector: 'p',
      steps: [{ match: 'Sezon (\\d+)', flags: 'i', group: 0 }],
    });

    fireEvent.input(screen.getByRole('textbox', { name: 'Flags' }), {
      target: { value: '' },
    });
    fireEvent.input(screen.getByRole('spinbutton', { name: 'Group' }), {
      target: { value: '' },
    });
    expect(field()).toEqual({
      selector: 'p',
      steps: [{ match: 'Sezon (\\d+)', flags: undefined, group: undefined }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove step' }));
    expect(field()).toEqual({ selector: 'p', steps: undefined });

    addStep('Replace part of it');
    fireEvent.input(screen.getByRole('textbox', { name: 'Replace' }), {
      target: { value: 'Sezon' },
    });
    fireEvent.input(screen.getByRole('textbox', { name: 'With' }), {
      target: { value: 'Season' },
    });
    fireEvent.input(screen.getByRole('textbox', { name: 'Flags' }), {
      target: { value: 'i' },
    });
    fireEvent.input(screen.getByRole('textbox', { name: 'Flags' }), {
      target: { value: '' },
    });
    expect(field()).toEqual({
      selector: 'p',
      steps: [{ replace: 'Sezon', with: 'Season', flags: undefined }],
    });

    addStep('Keep part of it (expression)');
    addStep('"3. Sezon" → "Season 3"');
    expect(field()).toEqual({
      selector: 'p',
      steps: [
        { replace: 'Sezon', with: 'Season', flags: undefined },
        { match: '(.+)' },
        { preset: 'tr-season-markers' },
      ],
    });

    chooseOption(
      screen.getByRole('combobox', { name: 'Transform' }),
      'tr-season-markers',
    );
    expect(field()!).toMatchObject({
      steps: [{}, {}, { preset: 'tr-season-markers' }],
    });
  });

  it('falls back to further extractions', () => {
    const { field } = setUp({ selector: 'p' });

    fireEvent.click(screen.getByRole('button', { name: 'Add a fallback' }));
    expect(field()).toEqual([{ selector: 'p' }, {}]);

    fireEvent.input(screen.getAllByRole('textbox', { name: /^Element/ })[1], {
      target: { value: 'h3' },
    });
    expect(field()).toEqual([{ selector: 'p' }, { selector: 'h3' }]);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Remove fallback' })[0],
    );
    expect(field()).toEqual({ selector: 'h3' });
  });

  it('can leave an optional value out', () => {
    const { field } = setUp(undefined, { optional: true });

    expect(screen.queryByRole('list')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Read it' }));
    expect(field()).toEqual({});

    fireEvent.click(screen.getByRole('button', { name: "Don't read" }));
    expect(field()).toBeUndefined();
  });

  it('reads the page again after it changed', () => {
    const { pageChanged, elements } = setUp({ selector: 'h3' });

    elements[2].querySelector('h3')!.textContent = 'One Piece';

    expect(read()[2]).toBe('Nothing read');

    pageChanged();

    expect(read()[2]).toBe('One Piece');
  });
});

describe('useEditor', () => {
  it('only works inside the editor', () => {
    expect(() => useEditor()).toThrow(
      'useEditor is only available in the editor',
    );
  });
});
