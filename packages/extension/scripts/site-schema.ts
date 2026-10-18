import { toJsonSchema } from '@valibot/to-json-schema';

import { Condition, SiteConfigSchema } from '../src/sites/schema';
import { log, r } from './utils';

export const siteSchemaPath = r('src/sites/site.schema.json');

/**
 * The JSON Schema that `site.json` files point at for autocomplete. Checks that need code (regex and selector
 * validity, CSS rules) aren't expressible in it; the build and the extension still run them.
 */
export function createSiteJsonSchema() {
  const schema = toJsonSchema(SiteConfigSchema, {
    errorMode: 'ignore',
    definitions: { Condition },
    target: 'draft-07',
  });

  return `${JSON.stringify(
    { ...schema, title: 'AniScore site config' },
    null,
    2,
  )}\n`;
}

if (import.meta.main) {
  await Bun.write(siteSchemaPath, createSiteJsonSchema());
  log('PRE', 'Site config schema written to src/sites/site.schema.json');
}
