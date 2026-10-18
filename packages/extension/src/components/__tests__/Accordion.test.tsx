import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import { Accordion, AccordionItem } from '../Accordion';

afterEach(cleanup);

function renderAccordion(props: Partial<Parameters<typeof Accordion>[0]> = {}) {
  render(() => (
    <Accordion class="extra" data-testid="accordion" {...props}>
      <AccordionItem value="characters" trigger="Characters">
        Frieren
      </AccordionItem>
      <AccordionItem value="relations" trigger="Relations" class="item">
        Sequel
      </AccordionItem>
    </Accordion>
  ));
}

const trigger = (name: string) => screen.getByRole('button', { name });
const isExpanded = (name: string) =>
  trigger(name).getAttribute('aria-expanded') === 'true';

describe('accordion', () => {
  it('starts collapsed and toggles an item', () => {
    renderAccordion({ collapsible: true });

    const region = screen
      .getByText('Frieren')
      .closest('[role="region"]') as HTMLElement;

    expect(screen.getByTestId('accordion').className).toContain('extra');
    expect(isExpanded('Characters')).toBe(false);
    expect(region.style.height).toBe('0px');
    expect(trigger('Characters').getAttribute('aria-controls')).toBeNull();

    fireEvent.click(trigger('Characters'));

    expect(isExpanded('Characters')).toBe(true);
    expect(region.style.height).toBe('var(--kb-accordion-content-height)');
    expect(trigger('Characters').getAttribute('aria-controls')).toBe(
      'accordion-content-characters',
    );
    expect(region.hasAttribute('data-expanded')).toBe(true);

    fireEvent.click(trigger('Characters'));

    expect(isExpanded('Characters')).toBe(false);
    expect(region.hasAttribute('data-closed')).toBe(true);
  });

  it('opens one item at a time unless multiple', () => {
    renderAccordion({ defaultValue: 'characters' });

    expect(isExpanded('Characters')).toBe(true);

    fireEvent.click(trigger('Relations'));

    expect(isExpanded('Characters')).toBe(false);
    expect(isExpanded('Relations')).toBe(true);
  });

  it('keeps several items open when multiple', () => {
    renderAccordion({ multiple: true, defaultValue: ['characters'] });

    fireEvent.click(trigger('Relations'));

    expect(isExpanded('Characters')).toBe(true);
    expect(isExpanded('Relations')).toBe(true);
  });

  it('closes an open item by default', () => {
    renderAccordion({ defaultValue: 'relations' });

    fireEvent.click(trigger('Relations'));

    expect(isExpanded('Relations')).toBe(false);
  });

  it('keeps an open item open when not collapsible', () => {
    renderAccordion({ collapsible: false, defaultValue: 'relations' });

    fireEvent.click(trigger('Relations'));

    expect(isExpanded('Relations')).toBe(true);
  });

  it('throws when an item is outside an accordion', () => {
    expect(() =>
      render(() => (
        <AccordionItem value="orphan" trigger="Orphan">
          Content
        </AccordionItem>
      )),
    ).toThrow('AccordionItem must be used within an Accordion');
  });
});
