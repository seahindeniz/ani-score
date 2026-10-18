import type { Condition } from '~/sites/schema';

import { looksDark } from './detect';

type Root = 'html' | 'body';

export interface ThemeSnapshot {
  classes: Record<Root, string[]>;
  attributes: Record<Root, Record<string, string>>;
  storage: Record<string, string>;
  dark: boolean;
}

const roots = (): Record<Root, Element> => ({
  html: document.documentElement,
  body: document.body,
});

// Theme values are short words ("dark", "1"); long values are other state
const isShort = (value: string) => value.length <= 20;

function attributesOf(element: Element) {
  return Object.fromEntries(
    Array.from(element.attributes)
      .filter(
        ({ name, value }) =>
          name !== 'class' && name !== 'style' && isShort(value),
      )
      .map(({ name, value }) => [name, value]),
  );
}

function storage() {
  try {
    return Object.fromEntries(
      Object.entries(window.localStorage).filter(([, value]) => isShort(value)),
    );
  } catch {
    // Storage can be blocked
    return {};
  }
}

/**
 * Where sites keep their light or dark mode: the classes and attributes of `<html>` and `<body>`, and local storage.
 * `probe` is where the page's darkness is checked, e.g. a card, since some sites color a wrapper rather than the body.
 */
export function snapshotTheme(probe: Element = document.body): ThemeSnapshot {
  const { html, body } = roots();

  return {
    classes: {
      html: Array.from(html.classList),
      body: Array.from(body.classList),
    },
    attributes: { html: attributesOf(html), body: attributesOf(body) },
    storage: storage(),
    dark: looksDark(probe),
  };
}

const quote = (value: string) => JSON.stringify(value);

/**
 * The condition that tells the dark mode from the light one, from a snapshot of each (in either order), or `undefined`
 * when the page didn't change between them, or nothing that changed looks like a theme.
 */
export function switchCondition(
  before: ThemeSnapshot,
  after: ThemeSnapshot,
): Condition | undefined {
  if (before.dark === after.dark) return undefined;

  const [dark, light] = after.dark ? [after, before] : [before, after];
  const conditions: Condition[] = [];

  for (const root of ['html', 'body'] as const) {
    const added = dark.classes[root].filter(
      (name) => !light.classes[root].includes(name),
    );
    const removed = light.classes[root].filter(
      (name) => !dark.classes[root].includes(name),
    );
    const attribute = Object.keys({
      ...dark.attributes[root],
      ...light.attributes[root],
    }).find(
      (name) =>
        dark.attributes[root][name] !== light.attributes[root][name]
        && dark.attributes[root][name] !== undefined,
    );

    if (added[0]) {
      conditions.push({ selector: `${root}.${CSS.escape(added[0])}` });
    } else if (attribute) {
      conditions.push({
        selector: `${root}[${attribute}=${quote(dark.attributes[root][attribute])}]`,
      });
    } else if (removed[0]) {
      conditions.push({ selector: `${root}:not(.${CSS.escape(removed[0])})` });
    }
  }

  const key = Object.keys(dark.storage).find(
    (name) => dark.storage[name] !== light.storage[name],
  );

  if (key) {
    conditions.push({ localStorage: { key, equals: dark.storage[key] } });
  }

  return conditions[0];
}

/**
 * Waits for the user to flip the site's own light/dark switch, then reports how to tell the modes apart. Checks on
 * every change to `<html>` and `<body>`, and twice a second for transitions and storage. Returns a function that stops
 * waiting.
 */
export function learnThemeSwitch(
  onLearned: (condition: Condition) => void,
  probe?: Element,
) {
  const before = snapshotTheme(probe);
  const check = () => {
    const condition = switchCondition(before, snapshotTheme(probe));

    if (!condition) return;

    stop();
    onLearned(condition);
  };
  const observer = new MutationObserver(check);
  const timer = setInterval(check, 500);

  function stop() {
    observer.disconnect();
    clearInterval(timer);
  }

  observer.observe(document.documentElement, { attributes: true });
  observer.observe(document.body, { attributes: true });

  return stop;
}

/**
 * A condition in words, e.g. "html.dark" or "localStorage theme is dark".
 */
export function describeCondition(condition: Condition): string {
  if ('selector' in condition) return condition.selector;

  if ('localStorage' in condition) {
    return `the site stores ${condition.localStorage.key} = ${condition.localStorage.equals}`;
  }

  return condition.any.map(describeCondition).join(' or ');
}
