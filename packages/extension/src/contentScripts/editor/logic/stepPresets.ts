import type { SiteStep } from '~/sites/schema';

export interface StepPreset {
  /**
   * Names the preset for the editor's own use, e.g. the fallback for a picked number.
   */
  id: string;
  label: string;
  steps: SiteStep[];
}

/**
 * Ready-made steps for the formats seen on anime sites. Adding one appends its steps to an extraction, where they can
 * still be edited.
 */
export const stepPresets: StepPreset[] = [
  { id: 'first-number', label: 'First number', steps: [{ match: '(\\d+)' }] },
  {
    id: 'number-then-episode',
    label: '"12. Bölüm" → 12',
    steps: [{ match: '(\\d+)(?:[.,]\\d+)?\\.\\s*B[öo]l[üu]m', flags: 'i' }],
  },
  {
    id: 'episode-then-number',
    label: '"Bölüm 12" → 12',
    steps: [{ match: 'B[öo]l[üu]m\\s*(\\d+)', flags: 'i' }],
  },
  {
    id: 'english-episode',
    label: '"Episode 12" → 12',
    steps: [{ match: '(?:Episode|Ep\\.?)\\s*(\\d+)', flags: 'i' }],
  },
  {
    id: 'number-then-season',
    label: '"2. Sezon" → 2',
    steps: [{ match: '(\\d+)\\.?\\s*Sezon', flags: 'i' }],
  },
  {
    id: 'season-then-number',
    label: '"Sezon 2" → 2',
    steps: [{ match: 'Sezon\\s*(\\d+)', flags: 'i' }],
  },
  {
    id: 'sxe-season',
    label: '"S2E5" → season 2',
    steps: [{ match: 'S(\\d+)\\s*[-·]?\\s*E\\d', flags: 'i' }],
  },
  {
    id: 'sxe-episode',
    label: '"S2E5" → episode 5',
    steps: [{ match: 'S\\d+\\s*[-·]?\\s*E(\\d+)', flags: 'i' }],
  },
  {
    id: 'last-number',
    label: 'Last number (e.g. in a link)',
    steps: [{ match: '(\\d+)\\D*$' }],
  },
  {
    id: 'text-before-episode',
    label: 'Text before "12. Bölüm"',
    steps: [
      { match: '^(.*?)[\\s,]*\\d+(?:[.,]\\d+)?\\.\\s*B[öo]l[üu]m', flags: 'i' },
    ],
  },
  {
    id: 'text-before-season',
    label: 'Text before "2. Sezon"',
    steps: [{ match: '^(.*?)[\\s,]*\\d+\\.?\\s*Sezon', flags: 'i' }],
  },
  {
    id: 'season-markers',
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
