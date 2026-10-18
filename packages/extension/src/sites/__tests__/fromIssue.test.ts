import { describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  configFromIssue,
  issueFields,
  type IssueResult,
  writeSite,
} from '../../../scripts/site-config-from-issue';
import { loadBundledSites } from '../../../scripts/sites';
import type { SiteConfig } from '../schema';
import { shareLink } from '../share';

const config: SiteConfig = {
  schemaVersion: 1,
  id: 'openani',
  name: 'OpenAni',
  matches: ['*://openani.me/*'],
  css: '.episodes { gap: 30px }',
  pages: [
    {
      match: { path: '^/episodes/latest/\\d+$' },
      cards: [
        {
          selector: 'a.anime-card',
          title: { selector: '.anime-name' },
          inject: { position: 'append' },
        },
      ],
    },
  ],
};

// What GitHub makes of the "Site integration" issue form
function issueBody(json: string) {
  return `### Site

https://openani.me/episodes/latest/1

### Other pages with episode cards

_No response_

### Config

\`\`\`json
${json}
\`\`\`

### Notes

_No response_

### Checks

- [X] I checked the config on the pages above with the editor's live preview`;
}

describe('shareLink', () => {
  it("prefills the issue form with the config, and the site's address", () => {
    const { url, pasteConfig } = shareLink(
      config,
      'https://openani.me/episodes/latest/1',
    );
    const params = new URL(url).searchParams;

    expect(pasteConfig).toBe(false);
    expect(url).toStartWith(
      'https://github.com/seahindeniz/ani-score/issues/new?',
    );
    expect(params.get('template')).toBe('site-integration.yml');
    expect(params.get('title')).toBe('Site: OpenAni');
    expect(params.get('site-url')).toBe('https://openani.me/episodes/latest/1');
    expect(JSON.parse(params.get('config')!)).toEqual(config);
  });

  it("uses the config's host without a page, and leaves out a config too long for a link", () => {
    const long = {
      ...config,
      matches: ['*://*.openani.me/*'],
      css: 'a'.repeat(9000),
    };
    const { url, pasteConfig } = shareLink(long);
    const params = new URL(url).searchParams;

    expect(pasteConfig).toBe(true);
    expect(params.get('site-url')).toBe('https://openani.me/');
    expect(params.has('config')).toBe(false);
    expect(
      new URL(shareLink({ ...config, matches: [] }).url).searchParams.get(
        'site-url',
      ),
    ).toBe('');
  });
});

describe('configFromIssue', () => {
  it('reads the config and the site from the issue', () => {
    expect(configFromIssue(issueBody(JSON.stringify(config, null, 2)))).toEqual(
      {
        success: true,
        config,
        siteUrl: 'https://openani.me/episodes/latest/1',
      },
    );
    expect(issueFields(issueBody('{}'))).toMatchObject({
      Site: 'https://openani.me/episodes/latest/1',
      Notes: '_No response_',
      Config: '{}',
    });
  });

  it('only takes a web address as the site', () => {
    const body = issueBody(JSON.stringify(config)).replace(
      'https://openani.me/episodes/latest/1',
      'javascript:alert(1)\nhttps://openani.me/',
    );

    expect(configFromIssue(body)).toMatchObject({
      success: true,
      siteUrl: undefined,
    });
  });

  it("refuses a body that isn't exactly the form", () => {
    const body = issueBody(JSON.stringify(config));
    const formError: IssueResult = {
      success: false,
      error:
        "The issue doesn't have the form's sections (Site, Other pages with episode cards, Config, Notes, Checks), each once and in that order.",
    };

    // A second config, which the reviewer might not notice
    expect(
      configFromIssue(`${body}\n\n### Config\n\n\`\`\`json\n{}\n\`\`\``),
    ).toEqual(formError);
    expect(configFromIssue('### Site\n\nhttps://openani.me/')).toEqual(
      formError,
    );
  });

  it('says what is wrong with the config', () => {
    expect(configFromIssue(issueBody(''))).toEqual({
      success: false,
      error: 'The issue has no config.',
    });
    expect(configFromIssue(issueBody('{ nope'))).toMatchObject({
      success: false,
      error: expect.stringMatching(/^The config isn't valid JSON:/),
    });
    expect(
      configFromIssue(issueBody(JSON.stringify({ ...config, id: 'Open Ani' }))),
    ).toMatchObject({
      success: false,
      error: expect.stringContaining('The id may only contain'),
    });
  });
});

describe('writeSite', () => {
  it('writes an optional bundled site, with its CSS in style.css', () => {
    const sitesDir = mkdtempSync(join(tmpdir(), 'ani-score-sites-'));

    expect(writeSite({ ...config, access: 'required' }, sitesDir)).toEqual({
      dir: join(sitesDir, 'openani'),
      updated: false,
    });

    const json = JSON.parse(
      readFileSync(join(sitesDir, 'openani/site.json'), 'utf-8'),
    );

    expect(json.$schema).toBe('../site.schema.json');
    expect(json).not.toHaveProperty('access');
    expect(json).not.toHaveProperty('css');
    expect(readFileSync(join(sitesDir, 'openani/style.css'), 'utf-8')).toBe(
      '.episodes { gap: 30px }\n',
    );
    // What the build reads back
    expect(loadBundledSites(sitesDir)).toEqual([
      { ...config, css: '.episodes { gap: 30px }\n' },
    ]);

    // An update without CSS empties the old style.css
    expect(writeSite({ ...config, css: undefined }, sitesDir).updated).toBe(
      true,
    );
    expect(readFileSync(join(sitesDir, 'openani/style.css'), 'utf-8')).toBe('');

    writeSite({ ...config, id: 'plain', css: undefined }, sitesDir);
    expect(existsSync(join(sitesDir, 'plain/style.css'))).toBe(false);

    writeFileSync(join(sitesDir, 'openani/style.css'), 'stale');
    writeSite(config, sitesDir);
    expect(readFileSync(join(sitesDir, 'openani/style.css'), 'utf-8')).toBe(
      '.episodes { gap: 30px }\n',
    );
  });
});
