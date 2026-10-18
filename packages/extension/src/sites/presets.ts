/**
 * Transforms a site config can apply to an extracted value by name (`{ "preset": "…" }`). They live in code, so a new
 * need (another language's markers, say) is met by adding one here rather than by running code from a config.
 */
export const presets = {
  // The database's titles and synonyms use "Season 3" / "Part 2" instead of the Turkish markers
  'tr-season-markers': (text: string) =>
    text
      .replace(/(\d+)\.\s*Sezon/g, 'Season $1')
      .replace(/(\d+)\.\s*Kısım/g, 'Part $1'),
} satisfies Record<string, (text: string) => string>;

export type PresetName = keyof typeof presets;

export const presetNames = Object.keys(presets) as PresetName[];
