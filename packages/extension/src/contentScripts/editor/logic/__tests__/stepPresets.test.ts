import { describe, expect, it } from 'bun:test';

import { readField } from '~/contentScripts/sites/extract';

import { describeStep, stepPresets } from '../stepPresets';

const apply = (label: string, text: string) => {
  const card = document.createElement('div');

  card.textContent = text;

  return readField(card, {
    steps: stepPresets.find((preset) => preset.label === label)!.steps,
  });
};

describe('stepPresets', () => {
  it('reads the formats found on anime sites', () => {
    expect(apply('First number', 'Blm 99')).toBe('99');
    expect(apply('"12. Bölüm" → 12', 'Frieren 2. Sezon 12. Bölüm İzle')).toBe(
      '12',
    );
    expect(apply('"Bölüm 12" → 12', 'Bölüm 12')).toBe('12');
    expect(apply('"Bölüm 12" → 12', ' 2. Sezon 3. Bolum ')).toBe('');
    expect(apply('"12. Bölüm" → 12', ' 2. Sezon 3. Bolum ')).toBe('3');
    expect(apply('"Episode 12" → 12', 'Ep. 7')).toBe('7');
    expect(apply('"2. Sezon" → 2', '3.Sezon 30.Bölüm')).toBe('3');
    expect(apply('"Sezon 2" → 2', 'Sezon 2')).toBe('2');
    expect(apply('"S2E5" → season 2', 'S01E04')).toBe('01');
    expect(apply('"S2E5" → episode 5', 'S1-E4')).toBe('4');
    expect(apply('Last number (e.g. in a link)', '/anime/x/2/3')).toBe('3');
    expect(
      apply('Text before "12. Bölüm"', 'Magical Explorer 1. Sezon, 4. Bölüm'),
    ).toBe('Magical Explorer 1. Sezon');
    expect(
      apply('Text before "2. Sezon"', 'Magical Explorer 1. Sezon, 4. Bölüm'),
    ).toBe('Magical Explorer');
    expect(apply('"3. Sezon" → "Season 3"', 'Titan 3. Sezon')).toBe(
      'Titan Season 3',
    );
  });
});

describe('describeStep', () => {
  it('says what a step does', () => {
    expect(describeStep({ match: '(\\d+)' })).toBe('Keep group 1 of /(\\d+)/');
    expect(describeStep({ match: 'a', flags: 'i', group: 0 })).toBe(
      'Keep the match of /a/i',
    );
    expect(describeStep({ replace: 'a', with: 'b', flags: 'i' })).toBe(
      'Replace /a/i with "b"',
    );
    expect(describeStep({ replace: 'a', with: '' })).toBe(
      'Replace /a/ with ""',
    );
    expect(describeStep({ preset: 'tr-season-markers' })).toBe(
      'Apply tr-season-markers',
    );
  });
});
