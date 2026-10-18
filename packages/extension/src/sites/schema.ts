import * as v from 'valibot';

import { matchPatternFormat } from './matchPattern';
import { presetNames } from './presets';

/**
 * Bumped only for changes that old configs can't satisfy; `parseSiteConfig` then migrates them. New optional keys
 * don't need a bump.
 */
export const currentSchemaVersion = 1;

function compiles(source: string, flags?: string) {
  try {
    new RegExp(source, flags);

    return true;
  } catch {
    return false;
  }
}

// The build scripts also validate configs, and they have no DOM (nor its types)
interface QueryableDocument {
  createDocumentFragment: () => {
    querySelector: (selector: string) => unknown;
  };
}

/**
 * Selectors are checked where there is a DOM to parse them: in the extension and in the unit tests.
 */
function canQuery(selector: string) {
  const { document } = globalThis as { document?: QueryableDocument };

  try {
    document?.createDocumentFragment().querySelector(selector);

    return true;
  } catch {
    return false;
  }
}

const Selector = v.pipe(
  v.string(),
  v.nonEmpty('A selector cannot be empty'),
  v.check(canQuery, (issue) => `Invalid CSS selector: ${issue.input}`),
);

const RegExpSource = v.pipe(
  v.string(),
  v.nonEmpty('A regular expression cannot be empty'),
  v.check(
    (source) => compiles(source),
    (issue) => `Invalid regular expression: ${issue.input}`,
  ),
);

// `g` and `y` change how matching works and aren't needed
const RegExpFlags = v.pipe(
  v.string(),
  v.regex(/^[imsu]*$/, 'Regular expression flags may only be i, m, s and u'),
);

// Resolves CSS escapes such as `\75 rl(`, so they can't hide what the checks below look for
const unescapeCSS = (css: string) =>
  css.replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_, hex: string, char: string) =>
    hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : char,
  );

/**
 * Shared configs run on everyone's pages, so their CSS may not load anything from elsewhere (tracking, or leaking
 * the page through attribute selectors). `data:` URLs are fine.
 */
const CSS = v.pipe(
  v.string(),
  v.check(
    (css) =>
      !/@import|image-set\(|\bsrc\(|url\(\s*(?!['"]?\s*data:)/i.test(
        unescapeCSS(css),
      ),
    'CSS may not load other resources: @import, image-set(), src() and url() other than data: URLs are not allowed',
  ),
);

const Source = v.union(
  [
    v.picklist(['text', 'ownText']),
    v.strictObject({ attr: v.pipe(v.string(), v.nonEmpty()) }),
  ],
  'A source is "text", "ownText" or { "attr": "<attribute name>" }',
);

// An empty alternative always matches, and the match has an entry per capture group
const groupCount = (source: string, flags?: string) =>
  new RegExp(`${source}|`, flags).exec('')!.length - 1;

const Step = v.union(
  [
    v.pipe(
      v.strictObject({
        match: v.pipe(
          RegExpSource,
          v.description(
            'Keeps what a capture group matched (group 1 by default); no match leaves the value empty',
          ),
        ),
        flags: v.optional(RegExpFlags),
        group: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
      }),
      v.check(
        (step) => compiles(step.match, step.flags),
        'The flags do not fit this regular expression',
      ),
      // Valibot runs every check; an invalid expression is already reported above
      v.check(
        (step) =>
          !compiles(step.match, step.flags)
          || (step.group ?? 1) <= groupCount(step.match, step.flags),
        'The regular expression has no such capture group',
      ),
    ),
    v.pipe(
      v.strictObject({
        replace: v.pipe(
          RegExpSource,
          v.description(
            'Replaces every match with `with`, which may use $1, $2…',
          ),
        ),
        with: v.string(),
        flags: v.optional(RegExpFlags),
      }),
      v.check(
        (step) => compiles(step.replace, step.flags),
        'The flags do not fit this regular expression',
      ),
    ),
    v.strictObject({ preset: v.picklist(presetNames) }),
  ],
  'A step is { "match": … }, { "replace": …, "with": … } or { "preset": … }',
);

const Extract = v.strictObject({
  selector: v.optional(
    v.pipe(
      Selector,
      v.description('Relative to the card; leave it out to use the card'),
    ),
  ),
  source: v.optional(Source),
  steps: v.optional(v.array(Step)),
});

const Field = v.union(
  [Extract, v.pipe(v.array(Extract), v.minLength(1))],
  'A field is an extraction, or a list of them where the first non-empty result wins',
);

const Card = v.strictObject({
  selector: v.pipe(
    Selector,
    v.description(
      "The card's outermost element, the one that separates it from the other cards",
    ),
  ),
  exclude: v.optional(
    v.pipe(Selector, v.description('Skips cards that match this selector')),
  ),
  has: v.optional(
    v.pipe(
      Selector,
      v.description('Only keeps cards that contain a match of this selector'),
    ),
  ),
  title: Field,
  episode: v.optional(Field),
  allowMissingEpisode: v.optional(
    v.pipe(
      v.boolean(),
      v.description(
        "Shows the details also on cards whose episode can't be read (e.g. movies), instead of skipping them",
      ),
    ),
  ),
  season: v.optional(Field),
  inject: v.strictObject({
    selector: v.optional(Selector),
    position: v.picklist(['before', 'after', 'prepend', 'append']),
  }),
  shimmer: v.optional(v.strictObject({ selector: v.optional(Selector) })),
});

// A selector written into CSS, where these could end its rule and start another (the build can't parse selectors,
// so it doesn't catch them otherwise)
const CssSelector = v.pipe(
  Selector,
  v.check(
    (selector) => !/[{};]|\/\*|\*\//.test(selector),
    'A selector written into CSS cannot contain {, }, ; or comments',
  ),
);

const Page = v.strictObject({
  name: v.optional(v.string()),
  match: v.strictObject({
    path: v.optional(
      v.pipe(RegExpSource, v.description('Tested against location.pathname')),
    ),
    search: v.optional(
      v.pipe(RegExpSource, v.description('Tested against location.search')),
    ),
    selector: v.optional(
      v.pipe(
        Selector,
        v.description('The page only applies while this element exists'),
      ),
    ),
  }),
  css: v.optional(
    v.pipe(CSS, v.description('Applied while this page applies')),
  ),
  layout: v.optional(
    v.pipe(
      v.array(
        v.strictObject({
          container: CssSelector,
          mode: v.pipe(
            v.picklist(['grid', 'flex', 'block']),
            v.description('How the container lays out its cards'),
          ),
          spacing: v.optional(
            v.pipe(
              v.picklist(['gap', 'margin', 'padding']),
              v.description(
                "What spaces the cards: the container's gap (the default), or the margins or the padding of the elements in it",
              ),
            ),
          ),
          gap: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(200))),
          minCardWidth: v.optional(
            v.pipe(v.number(), v.minValue(0), v.maxValue(2000)),
          ),
        }),
      ),
      v.description(
        'Spacing for the elements that hold the cards, so the details have room; applied while this page applies',
      ),
    ),
  ),
  heights: v.optional(
    v.pipe(
      v.array(
        v.strictObject({
          selector: CssSelector,
          height: v.union([
            v.literal('auto'),
            v.pipe(v.number(), v.minValue(0), v.maxValue(2000)),
          ]),
        }),
      ),
      v.description(
        'Heights for elements in the cards whose fixed height leaves the details no room: "auto" to fit their content, or pixels; applied while this page applies',
      ),
    ),
  ),
  cards: v.pipe(v.array(Card), v.minLength(1)),
});

export type Condition =
  | { selector: string }
  | { localStorage: { key: string; equals: string } }
  | { any: Condition[] };

export const Condition: v.GenericSchema<Condition> = v.union(
  [
    v.strictObject({ selector: Selector }),
    v.strictObject({
      localStorage: v.strictObject({ key: v.string(), equals: v.string() }),
    }),
    v.strictObject({
      any: v.pipe(v.array(v.lazy(() => Condition)), v.minLength(1)),
    }),
  ],
  'A condition is { "selector": … }, { "localStorage": { "key": …, "equals": … } } or { "any": [ … ] }',
);

export const SiteConfigSchema = v.strictObject({
  $schema: v.optional(v.string()),
  schemaVersion: v.literal(currentSchemaVersion),
  id: v.pipe(
    v.string(),
    v.regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'The id may only contain lowercase letters, digits and dashes',
    ),
  ),
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(80),
    // It ends up in commit messages and pull request titles
    v.regex(/^[^\r\n]+$/, 'The name must be a single line'),
  ),
  matches: v.pipe(
    v.array(
      v.pipe(
        v.string(),
        v.regex(
          matchPatternFormat,
          'Use match patterns like *://example.com/*',
        ),
      ),
    ),
    v.minLength(1),
  ),
  access: v.optional(
    v.pipe(
      v.picklist(['required', 'optional']),
      v.description(
        'Bundled configs only: "required" sites are allowed at install, "optional" ones once the user enables them',
      ),
    ),
  ),
  theme: v.optional(
    v.union([
      v.picklist(['dark', 'light', 'system']),
      v.strictObject({
        dark: v.pipe(
          Condition,
          v.description(
            "Follows the site's theme: dark while the condition holds",
          ),
        ),
      }),
    ]),
  ),
  observe: v.optional(
    v.pipe(
      Selector,
      v.description('The element watched for changes; the body by default'),
    ),
  ),
  css: v.optional(
    v.pipe(CSS, v.description('Applied once one of the pages applies')),
  ),
  pages: v.pipe(v.array(Page), v.minLength(1)),
});

export type SiteConfig = v.InferOutput<typeof SiteConfigSchema>;
export type SitePage = SiteConfig['pages'][number];
export type SiteCard = SitePage['cards'][number];
export type SiteField = SiteCard['title'];
export type SiteExtract = Exclude<SiteField, unknown[]>;
export type SiteStep = NonNullable<SiteExtract['steps']>[number];

export type ParseResult =
  { success: true; config: SiteConfig } | { success: false; error: string };

/**
 * Validates a config from anywhere (bundled, stored, imported), migrating older schema versions first.
 */
export function parseSiteConfig(input: unknown): ParseResult {
  const version = (input as { schemaVersion?: unknown } | null)?.schemaVersion;

  if (typeof version === 'number' && version > currentSchemaVersion) {
    return {
      success: false,
      error: `This config needs a newer AniScore (schema version ${version})`,
    };
  }

  const result = v.safeParse(SiteConfigSchema, input);

  return result.success
    ? { success: true, config: result.output }
    : { success: false, error: v.summarize(result.issues) };
}
