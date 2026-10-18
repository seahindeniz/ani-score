import type { SiteStep } from '~/sites/schema';

export interface StepPreset {
  label: string;
  steps: SiteStep[];
}

/**
 * Ready-made steps for the formats seen on anime sites. Adding one appends its steps to an extraction, where they can
 * still be edited.
 */
export const stepPresets: StepPreset[] = [
  { label: 'First number', steps: [{ match: '(\\d+)' }] },
  {
    label: '"12. Bölüm" → 12',
    steps: [{ match: '(\\d+)(?:[.,]\\d+)?\\.\\s*B[öo]l[üu]m', flags: 'i' }],
  },
  {
    label: '"Bölüm 12" → 12',
    steps: [{ match: 'B[öo]l[üu]m\\s*(\\d+)', flags: 'i' }],
  },
  {
    label: '"Episode 12" → 12',
    steps: [{ match: '(?:Episode|Ep\\.?)\\s*(\\d+)', flags: 'i' }],
  },
  {
    label: '"2. Sezon" → 2',
    steps: [{ match: '(\\d+)\\.?\\s*Sezon', flags: 'i' }],
  },
  {
    label: '"Sezon 2" → 2',
    steps: [{ match: 'Sezon\\s*(\\d+)', flags: 'i' }],
  },
  {
    label: '"S2E5" → season 2',
    steps: [{ match: 'S(\\d+)\\s*[-·]?\\s*E\\d', flags: 'i' }],
  },
  {
    label: '"S2E5" → episode 5',
    steps: [{ match: 'S\\d+\\s*[-·]?\\s*E(\\d+)', flags: 'i' }],
  },
  {
    label: 'Last number (e.g. in a link)',
    steps: [{ match: '(\\d+)\\D*$' }],
  },
  {
    label: 'Text before "12. Bölüm"',
    steps: [
      { match: '^(.*?)[\\s,]*\\d+(?:[.,]\\d+)?\\.\\s*B[öo]l[üu]m', flags: 'i' },
    ],
  },
  {
    label: 'Text before "2. Sezon"',
    steps: [{ match: '^(.*?)[\\s,]*\\d+\\.?\\s*Sezon', flags: 'i' }],
  },
  {
    label: '"3. Sezon" → "Season 3"',
    steps: [{ preset: 'tr-season-markers' }],
  },
];

/**
 * A short description of a step, for the list of an extraction's steps.
 */
export function describeStep(step: SiteStep) {
  if ('match' in step) {
    return `Keep ${step.group === 0 ? 'the match' : `group ${step.group ?? 1}`} of /${step.match}/${step.flags ?? ''}`;
  }

  if ('replace' in step) {
    return `Replace /${step.replace}/${step.flags ?? ''} with "${step.with}"`;
  }

  return `Apply ${step.preset}`;
}
