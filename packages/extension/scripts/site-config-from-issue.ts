import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import type { SiteConfig } from '../src/sites/schema';
import { parseSiteConfig } from '../src/sites/schema';
import { r } from './utils';

// The headings the "Site integration" form produces, in order (`.github/ISSUE_TEMPLATE/site-integration.yml`)
export const formHeadings = [
  'Site',
  'Other pages with episode cards',
  'Config',
  'Notes',
  'Checks',
];

/**
 * The form's fields by label: the text under each `### Label` heading. `undefined` unless the body has exactly the
 * form's headings, in order, so an edited body can't show the reviewer one config and hand the workflow another (say,
 * under a second "Config" heading).
 */
export function issueFields(body: string) {
  const headings = Array.from(body.matchAll(/^### (.*)$/gm), ([, label]) =>
    label.trim(),
  );

  if (headings.join('\n') !== formHeadings.join('\n')) return undefined;

  const sections = body.split(/^### .*$/m).slice(1);

  return Object.fromEntries(
    formHeadings.map((label, index) => [label, sections[index].trim()]),
  ) as Record<(typeof formHeadings)[number], string>;
}

/**
 * The content of a field that is a single code block and nothing else, as the form renders the config. GitHub shows a
 * code block as is, so the reviewer sees exactly what gets parsed; text around it (an HTML comment, say) could hide
 * part of it.
 */
export const codeBlock = (text: string) =>
  /^```\w*\n([\s\S]*?)\n```$/.exec(text)?.[1];

export type IssueResult =
  | { success: true; config: SiteConfig; siteUrl?: string }
  | { success: false; error: string };

/**
 * The config proposed in a "Site integration" issue, validated like any other.
 */
export function configFromIssue(body: string): IssueResult {
  // An issue edited in GitHub's web editor comes back with Windows line endings
  const fields = issueFields(body.replace(/\r\n?/g, '\n'));

  if (!fields) {
    return {
      success: false,
      error: `The issue doesn't have the form's sections (${formHeadings.join(', ')}), each once and in that order.`,
    };
  }

  if (!fields.Config) {
    return { success: false, error: 'The issue has no config.' };
  }

  const json = codeBlock(fields.Config);

  if (json === undefined) {
    return {
      success: false,
      error:
        "The config must be the form's code block, with nothing around it.",
    };
  }

  let input: unknown;

  try {
    input = JSON.parse(json);
  } catch (error) {
    return {
      success: false,
      error: `The config isn't valid JSON: ${(error as Error).message}`,
    };
  }

  const result = parseSiteConfig(input);

  if (!result.success) return result;

  // Only a web address, which then only goes into the pull request's description
  const siteUrl = /^https?:\/\/\S+$/.test(fields.Site)
    ? fields.Site
    : undefined;

  return { success: true, config: result.config, siteUrl };
}

/**
 * Writes a proposed config as a bundled site: `site.json`, plus its CSS in `style.css`. A community site is always
 * optional (users turn it on), whatever the config says.
 */
export function writeSite(config: SiteConfig, sitesDir = r('src/sites')) {
  const dir = join(sitesDir, config.id);
  const { css, access: _, ...rest } = config;
  const updated = existsSync(dir);

  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'site.json'),
    `${JSON.stringify({ $schema: '../site.schema.json', ...rest }, null, 2)}\n`,
  );

  const stylePath = join(dir, 'style.css');

  if (css) writeFileSync(stylePath, `${css.trim()}\n`);
  else if (updated && existsSync(stylePath)) writeFileSync(stylePath, '');

  return { dir, updated };
}

// For the "Site integration" workflow: reads the issue from ISSUE_BODY, writes the site, and reports to GITHUB_OUTPUT
if (import.meta.main) {
  const result = configFromIssue(process.env.ISSUE_BODY ?? '');
  // A delimiter the issue's author can't guess, so a value can't end early and set outputs of its own
  const output = (name: string, value: string) => {
    const delimiter = `EOF_${crypto.randomUUID()}`;

    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `${name}<<${delimiter}\n${value}\n${delimiter}\n`,
      );
    }
  };

  if (!result.success) {
    output('error', result.error);
    console.error(result.error);
    process.exit(1);
  }

  const { updated } = writeSite(result.config);

  output('id', result.config.id);
  output('name', result.config.name);
  output('site-url', result.siteUrl ?? '');
  output('updated', String(updated));
  console.log(`${updated ? 'Updated' : 'Added'} src/sites/${result.config.id}`);
}
