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
import LucideDownload from '~icons/lucide/download';
import LucideEllipsis from '~icons/lucide/ellipsis';
import LucidePencil from '~icons/lucide/pencil';
import LucidePower from '~icons/lucide/power';
import LucidePowerOff from '~icons/lucide/power-off';
import LucideShare2 from '~icons/lucide/share-2';
import LucideTrash2 from '~icons/lucide/trash-2';
import LucideUpload from '~icons/lucide/upload';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { UserSite } from '~/logic';
import { useTurnedOffSitesStore, useUserSitesStore } from '~/logic';
import { editSite } from '~/logic/editor';
import { matchPatternFormat } from '~/sites/matchPattern';
import { resolveSites, siteFingerprint } from '~/sites/resolveSites';
import type { SiteConfig } from '~/sites/schema';
import { parseSiteConfig } from '~/sites/schema';
import { shareLink } from '~/sites/share';

const bundledById = new Map(bundledSites.map((site) => [site.id, site]));

// Granted at install, and the browser can't take them back
const requiredPatterns = new Set(
  bundledSites
    .filter((site) => site.access === 'required')
    .flatMap((site) => site.matches),
);

// The addresses whose access the user grants; the required ones come with the extension
const grantable = (site: SiteConfig) =>
  site.matches.filter((pattern) => !requiredPatterns.has(pattern));

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
 * The sites AniScore works on: bundled ones, some on from install and others turned on by the user, and the user's
 * own setups. Any of them can be turned off. Turning a site on asks the browser for access to it when AniScore has
 * none, and editing one opens the editor on the site.
 */
export const Sites: Component = () => {
  const store = useUserSitesStore();
  const turnedOff = useTurnedOffSitesStore();
  const resolved = createMemo(() => resolveSites(store.data(), bundledSites));
  const [permissionChanges, setPermissionChanges] = createSignal(0);
  const [allowed] = createResource(
    () => [resolved().sites, permissionChanges()] as const,
    async ([sites]) =>
      new Set(
        (
          await Promise.all(
            sites
              .filter((site) => grantable(site).length)
              .map(async (site) =>
                (await browser.permissions.contains({
                  origins: grantable(site),
                }))
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
  // The site whose removal waits for confirmation; kept here, as the rows are drawn again when access changes
  const [confirmingId, setConfirmingId] = createSignal<string>();

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

  const setOff = (id: string, off: boolean) =>
    turnedOff.setData([
      ...turnedOff.data().filter((item) => item !== id),
      ...(off ? [id] : []),
    ]);

  function turnOn(row: ReturnType<typeof rowOf>) {
    const { site } = row;

    // A site AniScore can still read comes back on its open tabs too
    if (row.readable) {
      setOff(site.id, false);
      setMessage({ kind: 'success', text: `${site.name} is on.` });
      return;
    }

    // Must run right in the click handler: browsers only prompt in response to the user
    void browser.permissions
      .request({ origins: site.matches })
      .then((granted) => {
        if (granted) setOff(site.id, false);

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
    const unused = unusedPatterns(site);

    setOff(site.id, true);

    if (unused.length) void browser.permissions.remove({ origins: unused });
  }

  function remove(site: SiteConfig) {
    const remaining = store.data().filter((entry) => idOf(entry) !== site.id);
    const unused = unusedPatterns(
      site,
      resolveSites(remaining, bundledSites).sites,
    );

    store.setData(remaining);
    setConfirmingId(undefined);

    // A built-in site stays as the user left it; their own setup is gone
    if (!bundledById.has(site.id)) setOff(site.id, false);

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
        ? `${site.name}'s setup is too long for a link, so it's on your clipboard: paste it into the form's Config field.`
        : `Opened a GitHub issue with ${site.name}'s setup.`,
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
    // Known right away for the sites AniScore reads from install, so they don't flash as off
    const readable =
      !grantable(site).length || Boolean(allowed()?.has(site.id));
    const on = readable && !turnedOff.data().includes(site.id);

    return { site, entry, readable, on };
  };
  const rows = createMemo(() =>
    resolved()
      .sites.map(rowOf)
      .sort((a, b) => a.site.name.localeCompare(b.site.name)),
  );
  const onRows = () => rows().filter((row) => row.on);
  const availableRows = () => rows().filter((row) => !row.on);
  // Rows by id, so a row stays mounted (and its menu open) while storage and access checks redraw the list
  const ids = (list: ReturnType<typeof rowOf>[]) =>
    list.map((row) => row.site.id);
  const rowById = (id: string) => rows().find((row) => row.site.id === id)!;

  // Opens the editor on the site, on its open tab or a new one; it asks for access right from the click
  function edit(site: SiteConfig) {
    const [host] = hostsOf(site);

    void editSite(site, `https://${host}/`)
      .then((opened) => {
        if (!opened) {
          setMessage({
            kind: 'error',
            text: `AniScore needs access to ${host} to open its editor there.`,
          });
        }
      })
      .catch(() =>
        setMessage({
          kind: 'error',
          text: `The editor didn't open on ${host}. Open one of its pages, then try again.`,
        }),
      );
  }

  const SiteRow: Component<{ row: ReturnType<typeof rowOf> }> = (props) => {
    const site = () => props.row.site;
    const bundled = () => bundledById.get(site().id);
    const outdated = () =>
      props.row.entry?.basedOn
      && bundled()
      && props.row.entry.basedOn !== siteFingerprint(bundled()!);
    const confirming = () => confirmingId() === site().id;

    return (
      <li class="flex flex-col gap-2 py-3" data-site={site().id}>
        <div class="flex items-center gap-3">
          <span
            aria-hidden="true"
            class="flex size-8 shrink-0 cursor-default select-none items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground"
          >
            {site().name.charAt(0).toUpperCase()}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-sm font-medium">{site().name}</span>
              <Show when={props.row.entry}>
                <Badge
                  variant="secondary"
                  class="shrink-0 px-1.5 py-0 text-[10px]"
                >
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
          <Button
            variant="ghost"
            size="icon"
            class="size-8 shrink-0 text-muted-foreground"
            aria-label={`Edit ${site().name}`}
            title="Edit on the site"
            onClick={() => edit(site())}
          >
            <LucidePencil aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              as={Button}
              variant="ghost"
              size="icon"
              class="size-8 shrink-0 text-muted-foreground"
              aria-label={`More for ${site().name}`}
            >
              <LucideEllipsis aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <Show
                when={props.row.on}
                fallback={
                  <DropdownMenuItem onSelect={() => turnOn(props.row)}>
                    <LucidePower aria-hidden="true" />
                    Turn on
                  </DropdownMenuItem>
                }
              >
                <DropdownMenuItem onSelect={() => turnOff(site())}>
                  <LucidePowerOff aria-hidden="true" />
                  Turn off
                </DropdownMenuItem>
              </Show>
              <Show when={props.row.entry}>
                {(entry) => (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void share(site())}>
                      <LucideShare2 aria-hidden="true" />
                      Share with everyone
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        download(`${site().id}.json`, entry().config)
                      }
                    >
                      <LucideDownload aria-hidden="true" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      onSelect={() => setConfirmingId(site().id)}
                    >
                      <LucideTrash2 aria-hidden="true" />
                      {bundled() ? 'Reset to built-in' : 'Delete'}
                    </DropdownMenuItem>
                  </>
                )}
              </Show>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Show when={outdated()}>
          <p class="m-0 pl-11 text-xs text-warning-foreground">
            The built-in version changed since you edited it.
          </p>
        </Show>
        {/* Removing the user's own setup can't be undone, so it asks first */}
        <Show when={confirming()}>
          <div
            role="group"
            aria-label={`Confirm for ${site().name}`}
            class="ml-11 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-solid border-border bg-muted/40 px-3 py-2"
          >
            <span class="flex-1 text-xs">
              {bundled()
                ? 'Drop your changes to this site?'
                : 'Delete your setup for this site?'}
            </span>
            <div class="flex gap-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setConfirmingId(undefined)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => remove(site())}
              >
                {bundled() ? 'Reset' : 'Delete'}
              </Button>
            </div>
          </div>
        </Show>
      </li>
    );
  };

  const heading = 'm-0 text-xs font-medium text-muted-foreground';

  return (
    <Card class="w-full">
      <CardHeader>
        <CardTitle>Sites</CardTitle>
        <CardDescription>
          Where AniScore shows ratings. Turning a site on lets AniScore read its
          pages.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-5">
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
          <section aria-label="On" class="flex flex-col">
            <h3 class={heading}>On</h3>
            <ul class="m-0 list-none divide-y divide-border p-0">
              <For each={ids(onRows())}>
                {(id) => <SiteRow row={rowById(id)} />}
              </For>
            </ul>
          </section>
        </Show>
        <Show when={availableRows().length}>
          {/* Choosing a site turns it on; the choice is the click the browser needs to ask for access */}
          <Select<ReturnType<typeof rowOf>>
            class="flex flex-col gap-2"
            options={availableRows()}
            optionValue={(row) => row.site.id}
            optionTextValue={(row) => row.site.name}
            value={null}
            placeholder="Choose a site to turn on"
            onChange={(row) => row && turnOn(row)}
            itemComponent={(item) => (
              <SelectItem item={item.item}>
                <span class="flex flex-col">
                  <span>{item.item.rawValue.site.name}</span>
                  <span class="text-xs text-muted-foreground">
                    {hostsOf(item.item.rawValue.site)[0]}
                  </span>
                </span>
              </SelectItem>
            )}
          >
            <SelectLabel class={heading}>Add a site</SelectLabel>
            <SelectTrigger>
              {/* Nothing stays selected: a chosen site leaves this list for the one above */}
              <SelectValue />
            </SelectTrigger>
            <SelectContent class="max-h-72 overflow-y-auto" />
          </Select>
        </Show>
        {/* The user's own setups that are off can still be edited, shared, exported and deleted */}
        <Show when={availableRows().some((row) => row.entry)}>
          <section aria-label="Your setups that are off" class="flex flex-col">
            <h3 class={heading}>Your setups that are off</h3>
            <ul class="m-0 list-none divide-y divide-border p-0">
              <For each={ids(availableRows().filter((row) => row.entry))}>
                {(id) => <SiteRow row={rowById(id)} />}
              </For>
            </ul>
          </section>
        </Show>
        <Show when={resolved().invalid.length}>
          <section aria-label="Can't be used" class="flex flex-col">
            <h3 class={heading}>Can't be used</h3>
            <ul class="m-0 list-none divide-y divide-border p-0">
              <For each={resolved().invalid}>
                {(invalid) => (
                  <li class="flex flex-col gap-1 py-3">
                    <span class="text-sm font-medium">
                      {String(invalid.id ?? 'Unnamed setup')}
                    </span>
                    <span class="text-xs text-error-foreground">
                      It no longer matches the setup format. Delete it, or
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
        <div class="flex flex-col gap-3 border-t border-t-solid border-border pt-4">
          <Show
            when={importing()}
            fallback={
              <Button
                size="sm"
                variant="outline"
                class="self-start"
                onClick={() => setImporting(true)}
              >
                <LucideUpload aria-hidden="true" />
                Import a setup
              </Button>
            }
          >
            <div class="flex flex-col gap-2">
              <textarea
                class="min-h-24 w-full rounded-md border border-input bg-transparent p-2 font-mono text-xs"
                placeholder="Paste a site setup (JSON)"
                aria-label="Site setup"
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
          <p class="m-0 text-xs leading-relaxed text-muted-foreground">
            To add another site, right-click one of its pages and choose
            “Integrate this site with AniScore”.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
