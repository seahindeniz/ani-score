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
import type { UserSite } from '~/logic';
import { useUserSitesStore } from '~/logic';
import { matchPatternFormat } from '~/sites/matchPattern';
import { resolveSites, siteFingerprint } from '~/sites/resolveSites';
import type { SiteConfig } from '~/sites/schema';
import { parseSiteConfig } from '~/sites/schema';

const bundledById = new Map(bundledSites.map((site) => [site.id, site]));

const requiredPatterns = new Set(
  bundledSites
    .filter((site) => site.access === 'required')
    .flatMap((site) => site.matches),
);

const idOf = (entry: UserSite) => (entry.config as { id?: unknown } | null)?.id;

function hostsOf(site: SiteConfig) {
  const hosts = Array.from(
    new Set(
      site.matches.map((pattern) =>
        matchPatternFormat.exec(pattern)![2].replace(/^\*\./, ''),
      ),
    ),
  );

  return hosts.length > 1
    ? `${hosts[0]} +${hosts.length - 1}`
    : (hosts[0] ?? '');
}

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
    setMessage({
      kind: 'success',
      text: `Imported ${config.name}. Turn it on to allow it on ${hostsOf(config)}.`,
    });
  }

  return (
    <Card class="w-xs text-left">
      <CardHeader>
        <CardTitle>Sites</CardTitle>
        <CardDescription>Where AniScore shows ratings.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <ul class="flex flex-col gap-3">
          <For each={resolved().sites}>
            {(site) => {
              const bundled = bundledById.get(site.id);
              const entry = () =>
                store.data().find((item) => idOf(item) === site.id);
              const required = () => !entry() && site.access === 'required';
              const isOn = () => required() || allowed()?.has(site.id);

              return (
                <li class="flex flex-col gap-1" data-site={site.id}>
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{site.name}</span>
                    <Badge variant={entry() ? 'secondary' : 'outline'}>
                      {entry() ? (bundled ? 'Edited' : 'Yours') : 'Built in'}
                    </Badge>
                  </div>
                  <span class="text-xs text-muted-foreground">
                    {hostsOf(site)}
                  </span>
                  <Show
                    when={
                      entry()?.basedOn
                      && bundled
                      && entry()!.basedOn !== siteFingerprint(bundled)
                    }
                  >
                    <span class="text-xs text-warning-foreground">
                      The built-in config changed since you edited it.
                    </span>
                  </Show>
                  <div class="flex flex-wrap items-center gap-2">
                    <Show
                      when={!required()}
                      fallback={
                        <span class="text-xs text-muted-foreground">
                          Always on
                        </span>
                      }
                    >
                      <Show
                        when={isOn()}
                        fallback={
                          <Button size="sm" onClick={() => turnOn(site)}>
                            Turn on
                          </Button>
                        }
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => turnOff(site)}
                        >
                          Turn off
                        </Button>
                      </Show>
                    </Show>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        download(`${site.id}.json`, entry()?.config ?? site)
                      }
                    >
                      Export
                    </Button>
                    <Show when={entry()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(site)}
                      >
                        {bundled ? 'Reset to built-in' : 'Delete'}
                      </Button>
                    </Show>
                  </div>
                </li>
              );
            }}
          </For>
          <For each={resolved().invalid}>
            {(invalid) => (
              <li class="flex flex-col gap-1">
                <span class="font-medium">
                  {String(invalid.id ?? 'Unnamed config')}
                </span>
                <span class="text-xs text-error-foreground">
                  {invalid.error}
                </span>
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
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
        <div class="flex flex-col gap-2">
          <textarea
            class="min-h-24 w-full rounded-md border border-input bg-transparent p-2 text-xs font-mono"
            placeholder="Paste a site config (JSON) to import it"
            aria-label="Site config"
            value={draft()}
            onInput={(event) => setDraft(event.currentTarget.value)}
          />
          <Button size="sm" disabled={!draft().trim()} onClick={importConfig}>
            Import
          </Button>
        </div>
        <Show when={message()}>
          <p
            role="status"
            class="text-xs"
            classList={{
              'text-success-foreground': message()!.kind === 'success',
              'text-error-foreground': message()!.kind === 'error',
            }}
          >
            {message()!.text}
          </p>
        </Show>
      </CardContent>
    </Card>
  );
};
