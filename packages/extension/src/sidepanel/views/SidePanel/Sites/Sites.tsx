import type { Component } from 'solid-js';
import {
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from 'solid-js';
import bundledSites from 'virtual:ani-score/sites';
import browser from 'webextension-polyfill';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Switch } from '~/components/ui/switch';
import type { UserSite } from '~/logic';
import { useUserSitesStore } from '~/logic';
import { matchPatternFormat } from '~/sites/matchPattern';
import { resolveSites, siteFingerprint } from '~/sites/resolveSites';
import type { SiteConfig } from '~/sites/schema';
import { parseSiteConfig } from '~/sites/schema';
import { shareLink } from '~/sites/share';

const bundledById = new Map(bundledSites.map((site) => [site.id, site]));

const requiredPatterns = new Set(
  bundledSites
    .filter((site) => site.access === 'required')
    .flatMap((site) => site.matches),
);

const idOf = (entry: UserSite) => (entry.config as { id?: unknown } | null)?.id;

// The site's addresses as people write them, without `www.` (most sites answer both ways)
const hostsOf = (site: SiteConfig) =>
  Array.from(
    new Set(
      site.matches.map((pattern) =>
        matchPatternFormat.exec(pattern)![2].replace(/^(\*\.|www\.)/, ''),
      ),
    ),
  );

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(data, null, 2)}\n`], {
      type: 'application/json',
    }),
  );
  const link = document.createElement('a');

  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

type Message = { kind: 'success' | 'error'; text: string };

/**
 * The sites AniScore works on: bundled ones, some always on and others turned on by the user, and the user's own
 * configs. Turning a site on asks the browser for access to it.
 */
export const Sites: Component = () => {
  const store = useUserSitesStore();
  const resolved = createMemo(() => resolveSites(store.data(), bundledSites));
  const [permissionChanges, setPermissionChanges] = createSignal(0);
  const [allowed] = createResource(
    () => [resolved().sites, permissionChanges()] as const,
    async ([sites]) =>
      new Set(
        (
          await Promise.all(
            sites.map(async (site) =>
              (await browser.permissions.contains({ origins: site.matches }))
                ? site.id
                : undefined,
            ),
          )
        ).filter((id) => id != null),
      ),
  );
  const [importing, setImporting] = createSignal(false);
  const [draft, setDraft] = createSignal('');
  const [message, setMessage] = createSignal<Message>();

  const onPermissionsChanged = () => setPermissionChanges((count) => count + 1);

  browser.permissions.onAdded.addListener(onPermissionsChanged);
  browser.permissions.onRemoved.addListener(onPermissionsChanged);
  onCleanup(() => {
    browser.permissions.onAdded.removeListener(onPermissionsChanged);
    browser.permissions.onRemoved.removeListener(onPermissionsChanged);
  });

  // Patterns of `site` that no other site in effect still needs
  const unusedPatterns = (site: SiteConfig, sites = resolved().sites) =>
    site.matches.filter(
      (pattern) =>
        !requiredPatterns.has(pattern)
        && !sites.some(
          (other) => other !== site && other.matches.includes(pattern),
        ),
    );

  function turnOn(site: SiteConfig) {
    // Must run right in the click handler: browsers only prompt in response to the user
    void browser.permissions
      .request({ origins: site.matches })
      .then((granted) => {
        setMessage(
          granted
            ? {
                kind: 'success',
                text: `${site.name} is on. Reload its open tabs to see ratings.`,
              }
            : {
                kind: 'error',
                text: `${site.name} stays off, since access was declined.`,
              },
        );
      });
  }

  function turnOff(site: SiteConfig) {
    void browser.permissions.remove({ origins: unusedPatterns(site) });
  }

  function remove(site: SiteConfig) {
    const remaining = store.data().filter((entry) => idOf(entry) !== site.id);
    const unused = unusedPatterns(
      site,
      resolveSites(remaining, bundledSites).sites,
    );

    store.setData(remaining);

    if (unused.length) void browser.permissions.remove({ origins: unused });
  }

  // Opens a GitHub issue that proposes the config for everyone; one too long for a link goes to the clipboard first
  async function share(site: SiteConfig) {
    const config = structuredClone(site);

    // Only bundled configs have one, and the maintainers decide it
    delete config.access;

    const link = shareLink(config);

    if (link.pasteConfig) {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    }

    await browser.tabs.create({ url: link.url });
    setMessage({
      kind: 'success',
      text: link.pasteConfig
        ? `${site.name}'s config is too long for a link, so it's on your clipboard: paste it into the form's Config field.`
        : `Opened a GitHub issue with ${site.name}'s config.`,
    });
  }

  function importConfig() {
    let input: unknown;

    try {
      input = JSON.parse(draft());
    } catch {
      setMessage({ kind: 'error', text: "That isn't valid JSON." });
      return;
    }

    const result = parseSiteConfig(input);

    if (!result.success) {
      setMessage({ kind: 'error', text: result.error });
      return;
    }

    const { config } = result;
    const bundled = bundledById.get(config.id);

    store.setData([
      ...store.data().filter((entry) => idOf(entry) !== config.id),
      {
        config,
        savedAt: Date.now(),
        ...(bundled && { basedOn: siteFingerprint(bundled) }),
      },
    ]);
    setDraft('');
    setImporting(false);
    setMessage({
      kind: 'success',
      text: `Imported ${config.name}. Turn it on to allow it on ${hostsOf(config)[0]}.`,
    });
  }

  const rowOf = (site: SiteConfig) => {
    const entry = store.data().find((item) => idOf(item) === site.id);
    const required = !entry && site.access === 'required';

    return { site, entry, required, on: required || allowed()?.has(site.id) };
  };
  const rows = createMemo(() =>
    resolved()
      .sites.map(rowOf)
      .sort((a, b) => a.site.name.localeCompare(b.site.name)),
  );
  const onRows = () => rows().filter((row) => row.on);
  const availableRows = () => rows().filter((row) => !row.on);

  const SiteRow: Component<{ row: ReturnType<typeof rowOf> }> = (props) => {
    const site = () => props.row.site;
    const bundled = () => bundledById.get(site().id);
    const outdated = () =>
      props.row.entry?.basedOn
      && bundled()
      && props.row.entry.basedOn !== siteFingerprint(bundled()!);

    return (
      <li class="flex flex-col gap-1.5 py-2.5" data-site={site().id}>
        <div class="flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-sm font-medium">{site().name}</span>
              <Show when={props.row.entry}>
                <Badge variant="secondary" class="px-1.5 py-0 text-[10px]">
                  {bundled() ? 'Edited' : 'Yours'}
                </Badge>
              </Show>
            </div>
            <span
              class="block truncate text-xs text-muted-foreground"
              title={hostsOf(site()).join(', ')}
            >
              {hostsOf(site())[0]}
            </span>
          </div>
          <Show
            when={!props.row.required}
            fallback={
              <span class="shrink-0 text-xs text-muted-foreground">
                Always on
              </span>
            }
          >
            <Switch
              label={site().name}
              checked={Boolean(props.row.on)}
              onChange={(on) => (on ? turnOn(site()) : turnOff(site()))}
            />
          </Show>
        </div>
        <Show when={outdated()}>
          <p class="m-0 text-xs text-warning-foreground">
            The built-in version changed since you edited it.
          </p>
        </Show>
        <Show when={props.row.entry}>
          {(entry) => (
            <div class="flex gap-3">
              <Button
                variant="quiet"
                size="inline"
                onClick={() => void share(site())}
              >
                Share
              </Button>
              <Button
                variant="quiet"
                size="inline"
                onClick={() => download(`${site().id}.json`, entry().config)}
              >
                Export
              </Button>
              <Button
                variant="quiet"
                size="inline"
                onClick={() => remove(site())}
              >
                {bundled() ? 'Reset to built-in' : 'Delete'}
              </Button>
            </div>
          )}
        </Show>
      </li>
    );
  };

  return (
    <Card class="w-xs text-left">
      <CardHeader>
        <CardTitle>Sites</CardTitle>
        <CardDescription>
          Where AniScore shows ratings. Turning a site on lets AniScore read its
          pages.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <Show when={message()}>
          <p
            role="status"
            class="m-0 rounded-md bg-secondary px-3 py-2 text-xs"
            classList={{
              'text-success-foreground': message()!.kind === 'success',
              'text-error-foreground': message()!.kind === 'error',
            }}
          >
            {message()!.text}
          </p>
        </Show>
        <Show when={onRows().length}>
          <section aria-label="On">
            <h3 class="m-0 text-xs font-medium text-muted-foreground">On</h3>
            <ul class="m-0 list-none divide-y divide-border p-0">
              <For each={onRows()}>{(row) => <SiteRow row={row} />}</For>
            </ul>
          </section>
        </Show>
        <Show when={availableRows().length}>
          <section aria-label="Available">
            <h3 class="m-0 text-xs font-medium text-muted-foreground">
              Available
            </h3>
            <ul class="m-0 list-none divide-y divide-border p-0">
              <For each={availableRows()}>{(row) => <SiteRow row={row} />}</For>
            </ul>
          </section>
        </Show>
        <Show when={resolved().invalid.length}>
          <section aria-label="Can't be used">
            <h3 class="m-0 text-xs font-medium text-muted-foreground">
              Can't be used
            </h3>
            <ul class="m-0 list-none divide-y divide-border p-0">
              <For each={resolved().invalid}>
                {(invalid) => (
                  <li class="flex flex-col gap-1 py-2.5">
                    <span class="text-sm font-medium">
                      {String(invalid.id ?? 'Unnamed config')}
                    </span>
                    <span class="text-xs text-error-foreground">
                      It no longer matches the config format. Delete it, or
                      import a fixed copy.
                    </span>
                    <details class="text-xs text-muted-foreground">
                      <summary class="cursor-pointer">What's wrong</summary>
                      <pre class="m-0 mt-1 whitespace-pre-wrap font-mono text-[11px]">
                        {invalid.error}
                      </pre>
                    </details>
                    <div>
                      <Button
                        variant="quiet"
                        size="inline"
                        onClick={() =>
                          store.setData(
                            store
                              .data()
                              .filter((_, index) => index !== invalid.index),
                          )
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>
        <Show
          when={importing()}
          fallback={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImporting(true)}
            >
              Import a config
            </Button>
          }
        >
          <div class="flex flex-col gap-2">
            <textarea
              class="min-h-24 w-full rounded-md border border-input bg-transparent p-2 font-mono text-xs"
              placeholder="Paste a site config (JSON)"
              aria-label="Site config"
              value={draft()}
              onInput={(event) => setDraft(event.currentTarget.value)}
            />
            <div class="flex gap-2">
              <Button
                size="sm"
                disabled={!draft().trim()}
                onClick={importConfig}
              >
                Import
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft('');
                  setImporting(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Show>
        <p class="m-0 text-xs text-muted-foreground">
          To add another site, right-click one of its pages and choose
          “Integrate this site with AniScore”.
        </p>
      </CardContent>
    </Card>
  );
};
